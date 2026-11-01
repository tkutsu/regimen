package dev.themos.regimen

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.FileNotFoundException
import java.util.concurrent.Executors

@InvokeArg
class FolderArgs {
  lateinit var dir: String
  lateinit var sub: String
  var suffix = ""
  var name = ""
  var text = ""
  var append = false
}

/**
 * The sync folder through Android's document APIs: the user picks it once, the app keeps
 * the permission, and reads and writes files in its subfolders. Called from `src/android.rs`,
 * and mirrors the desktop code in `src/files.rs`.
 */
@TauriPlugin
class FolderPlugin(private val activity: Activity) : Plugin(activity) {
  private val resolver get() = activity.contentResolver

  /** One thread for all file work: off the UI thread, and two writes never race to create a file. */
  private val io = Executors.newSingleThreadExecutor()

  private class Doc(val id: String, val name: String)

  @Command
  fun pick(invoke: Invoke) {
    startActivityForResult(invoke, Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), "picked")
  }

  @ActivityCallback
  fun picked(invoke: Invoke, result: ActivityResult) {
    val uri = result.data?.data
    if (result.resultCode != Activity.RESULT_OK || uri == null) return invoke.resolve()
    resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    invoke.resolveObject(uri.toString())
  }

  @Command
  fun list(invoke: Invoke) = background(invoke) { tree, args ->
    folder(tree, args.sub)?.let { children(tree, it) }.orEmpty().map { it.name }
  }

  @Command
  fun read(invoke: Invoke) = background(invoke) { tree, args ->
    val files = folder(tree, args.sub)?.let { children(tree, it) }.orEmpty().filter { it.name.endsWith(args.suffix) }
    files.map { doc ->
      val text = resolver.openInputStream(uri(tree, doc.id))!!.use { it.readBytes().decodeToString() }
      mapOf("name" to doc.name, "text" to text)
    }
  }

  @Command
  fun write(invoke: Invoke) = background(invoke) { tree, args ->
    val parent = folder(tree, args.sub) ?: create(tree, root(tree), Document.MIME_TYPE_DIR, args.sub)
    // octet-stream keeps the name as given; a text type could get ".txt" added.
    val file = children(tree, parent).find { it.name == args.name }?.id ?: create(tree, parent, "application/octet-stream", args.name)
    val mode = if (args.append) "wa" else "wt"
    ParcelFileDescriptor.AutoCloseOutputStream(resolver.openFileDescriptor(uri(tree, file), mode)!!).use {
      it.write(args.text.toByteArray())
      it.fd.sync()
    }
    null
  }

  @Command
  fun remove(invoke: Invoke) = background(invoke) { tree, args ->
    val file = folder(tree, args.sub)?.let { children(tree, it) }?.find { it.name == args.name }
    file?.let { DocumentsContract.deleteDocument(resolver, uri(tree, it.id)) }
    null
  }

  /** Parses the args, does the work on the IO thread, and answers with its result. */
  private fun background(invoke: Invoke, work: (Uri, FolderArgs) -> Any?) {
    val args = invoke.parseArgs(FolderArgs::class.java)
    io.execute {
      try {
        work(Uri.parse(args.dir), args)?.let(invoke::resolveObject) ?: invoke.resolve()
      } catch (e: Exception) {
        invoke.reject(e.message ?: e.toString())
      }
    }
  }

  private fun root(tree: Uri) = DocumentsContract.getTreeDocumentId(tree)

  private fun uri(tree: Uri, id: String) = DocumentsContract.buildDocumentUriUsingTree(tree, id)

  /** The id of the subfolder `name`, or null before the first write creates it. */
  private fun folder(tree: Uri, name: String) = children(tree, root(tree)).find { it.name == name }?.id

  /** What's directly inside a folder, in one query (DocumentFile.listFiles makes one per file). */
  private fun children(tree: Uri, parent: String): List<Doc> {
    val uri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent)
    val columns = arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME)
    val cursor = resolver.query(uri, columns, null, null, null) ?: throw FileNotFoundException("Can't open the folder")
    return cursor.use { generateSequence { if (it.moveToNext()) Doc(it.getString(0), it.getString(1)) else null }.toList() }
  }

  private fun create(tree: Uri, parent: String, mime: String, name: String): String {
    val doc = DocumentsContract.createDocument(resolver, uri(tree, parent), mime, name) ?: throw FileNotFoundException("Can't create $name")
    return DocumentsContract.getDocumentId(doc)
  }
}
