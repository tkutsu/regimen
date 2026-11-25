# Exercise muscle set credits

Reviewed 2026-11-25. Covers all 69 existing catalogue exercises and the new barbell upright row. The credits below match `src/domain/exerciseLibrary.ts`.

## What the percentages mean

These are estimates for counting training sets by muscle. They are not measured activation, force, fatigue, or expected growth percentages, and they do not sum to 100% across muscles.

- A primary muscle receives one set (100%).
- A substantial assisting muscle receives half a set (50%).
- An omitted muscle receives no catalogue credit. This means the evidence or exercise description is insufficient to assign a useful default, not that the muscle is inactive or cannot grow.

Pelland et al. compared counting indirect work as zero, half, or a full set. The half-set model had the strongest relative evidence across their dataset [1]. This supports a simple counting convention. It does not validate every primary/secondary assignment below, establish that each secondary muscle gets exactly half the stimulus, or test a quarter-set model. No exercise-specific evidence located in this review establishes the previous 25% credits.

Longitudinal muscle-size measurements inform target selection where available. Acute electromyography (EMG) helps identify participation and technique effects; it cannot be converted into a hypertrophy credit [2]. Where direct studies are missing, the catalogue uses exercise mechanics and clearly identified extrapolation. Even entries with longitudinal evidence retain estimated credits.

Assume controlled repetitions through a useful range and sets sufficiently challenging to train the listed muscles. Easy warm-ups and bodyweight sets are not automatically equivalent to hard training sets. Regimen currently counts completed sets without assessing their effort; this review does not change that calculation.

## Changes and their limits

- Leg-press adductors change from 25% to 50%. An MRI training study found growth in the adductor magnus as well as the gluteus maximus and quadriceps [5]. The half-set amount is the accounting convention, not a ratio calculated from those growth results.
- Front, goblet, bodyweight and hack squats gain 50% adductor credit. This extrapolates hip-extension assistance from squat and leg-press findings [3-5]; those four variants were not each tested longitudinally. Depth, stance and effort can change the contribution.
- Standard hip thrusts lose 25% hamstring credit. A nine-week trial found little hamstring growth despite gluteal growth [4]. The same omission for the bent-knee glute bridge is a conservative extrapolation, not a bridge-specific growth finding. Straight-knee bridges are a different exercise.
- Cable glute kickbacks change hamstrings from 25% to 50%. A study measuring gluteus maximus and biceps femoris supports participation of both [9]. This assumes an ankle-cuff kickback with the knee mostly extended; a deeply bent-knee variation can reduce hamstring contribution.
- Chest flies and the pec deck change front delts from 25% to 50%. Front-delt participation in horizontal adduction is supported by acute exercise comparisons [12, 13]. The extension to cable flies and pec decks is mechanical inference; no trial establishes a half-set credit for these variations.
- Supinated curls change forearm credit from 25% to 50%, and preacher curls gain 50%. This represents the brachioradialis acting as an elbow flexor, not general grip training. A handgrip study measured its participation even with a supinated grip [16]. Cable and preacher variants are extrapolations. Hammer curls retain 50%.
- Lateral raises gain 50% trap credit. Trapezius activity was substantial during dumbbell lateral raises in a small study of women with neck pain [18]. Cable lateral raises are an extrapolation assuming the scapula can rotate freely. This does not establish equal growth to shrugs.
- Conventional deadlifts and dumbbell shrugs lose their 25% forearm credit. Holding a weight establishes grip demand, but the research reviewed does not establish a general forearm hypertrophy credit for those exercises, especially when straps are used.
- Back squats lose 25% lower-back credit, and front squats lose 25% upper-back credit. Bracing remains necessary; the review did not establish the size of a hypertrophy credit for those supporting roles. These omissions should not be interpreted as evidence of zero stimulus.
- Barbell upright rows are added with side delts and traps at 100%, biceps at 50%. Grip-width EMG and the trap exercise study support these targets [17, 18]. The percentages remain estimates.

## Complete catalogue review

Every muscle listed in the primary column receives 100%; every muscle in the secondary column receives 50%. "None" means no secondary credit is assigned.

The basis column distinguishes evidence for some targets in the actual exercise from extrapolation. It never means that a paper validated all credits in that row. "Growth" means a longitudinal muscle-size study; "acute" means an EMG or biomechanics study; "inference" means applying mechanics or a related exercise's findings. Source numbers refer to the list below.

| Exercise ID | Primary muscles: 100% each | Secondary muscles: 50% each | Basis and qualification |
| --- | --- | --- | --- |
| `barbell-squat` | Quads, glutes | Adductors | Growth [3, 4]. Glute and adductor responses depend on depth; no hamstring default. |
| `front-squat` | Quads | Glutes, adductors | Acute [25], inference [3, 4]. Retain conservative glute credit; not a validated reduction versus back squats. |
| `goblet-squat` | Quads | Glutes, adductors | Inference [3, 4]; loading and depth vary. |
| `bodyweight-squat` | Quads | Glutes, adductors | Inference [3, 4]; must be challenging enough to supply a useful stimulus. |
| `leg-press` | Quads | Glutes, adductors | Growth [5]. Glute and adductor credits retained as assistance estimates; not a finding that they receive less growth than quads. |
| `hack-squat` | Quads | Glutes, adductors | Inference [3, 5]; machine geometry, foot placement and depth matter. |
| `bulgarian-split-squat` | Quads, glutes | Adductors | Inference from knee and hip extension [3, 4, 9]; no variant-specific fractional calibration. |
| `split-squat` | Quads, glutes | Adductors | Inference [3, 4]; stride and torso angle matter. |
| `walking-lunge` | Quads, glutes | Adductors | Inference [3, 4]; hip/knee extension and adductor assistance. |
| `reverse-lunge` | Glutes, quads | Adductors | Inference [3, 4]; no evidence for a different fraction solely from step direction. |
| `step-up` | Quads, glutes | None | Acute for glutes [9], inference for knee extensors. Step height and trailing-leg assistance matter. |
| `deadlift` | Glutes, hamstrings, lower back | Quads, traps | Acute/mechanical [6]. Retained estimates; whole-hamstring and trap credits are uncertain, not growth equivalences to curls or shrugs. |
| `sumo-deadlift` | Glutes, quads, adductors | Hamstrings, lower back | Acute/mechanical [7]. Wide-stance hip/knee extension; no measured fractional calibration. |
| `romanian-deadlift` | Hamstrings, glutes | Lower back, adductors | Growth for hamstrings [8], acute for hip/trunk extensors [6, 9]. Adductor credit is inference. |
| `dumbbell-romanian-deadlift` | Hamstrings, glutes | Lower back, adductors | Inference from barbell hip-hinge studies [6, 8, 9]; grip may limit loading. |
| `trap-bar-deadlift` | Quads, glutes | Hamstrings, lower back, traps | Acute/mechanical [10]. Starting knee/torso angles change emphasis; trap credit remains uncertain. |
| `good-morning` | Hamstrings, glutes | Lower back | Hip-hinge inference [6, 8]; not directly calibrated by the RDL studies. |
| `barbell-bench-press` | Chest | Triceps, front delts | Growth for chest/triceps [11], acute for delts [12]. |
| `dumbbell-bench-press` | Chest | Triceps, front delts | Inference from pressing [11, 12]; no equipment-specific fraction established. |
| `incline-barbell-press` | Chest | Front delts, triceps | Acute [14], pressing inference [11]. Assumes a moderate incline; steep inclines change target emphasis. |
| `incline-dumbbell-press` | Chest | Front delts, triceps | Inference [11, 14]; bench angle matters more than the shared exercise label. |
| `machine-chest-press` | Chest | Triceps, front delts | Pressing inference [11, 12]; handle path and machine geometry vary. |
| `push-up` | Chest | Triceps, front delts | Growth for chest/triceps [15], inference for delts [12]. Effort and relative loading matter. |
| `dip` | Chest, triceps | Front delts | Acute [26], pressing mechanics. Assumes parallel-bar dips, not bench dips. |
| `close-grip-bench-press` | Triceps | Chest, front delts | Acute [13], pressing inference [11]. Retain triceps emphasis; chest is still substantially involved. |
| `barbell-overhead-press` | Front delts | Triceps, side delts | Acute shoulder-press evidence [12, 13], elbow-extension mechanics. |
| `dumbbell-shoulder-press` | Front delts | Triceps, side delts | Acute [12], mechanical inference for triceps. |
| `machine-shoulder-press` | Front delts | Triceps, side delts | Inference [12, 13]; machine path and grip vary. |
| `upright-row` | Side delts, traps | Biceps | Acute [17, 18]. Grip changes recruitment; no activation-to-set conversion. |
| `pull-up` | Lats | Biceps, upper back | Acute [19], half-set convention [1]. Upper-back assignment is a broad grouping of scapular muscles. |
| `chin-up` | Lats | Biceps, upper back | Acute [19]. Retain half-set biceps credit; supination alone does not establish full curl equivalence. |
| `lat-pulldown` | Lats | Biceps, upper back | Mechanical inference from vertical pulling [19]; no fraction unique to this equipment. |
| `barbell-row` | Upper back, lats | Biceps, rear delts, lower back | Acute row evidence [21], inference from elbow flexor growth [20]. Trunk credit assumes an unsupported hinge. |
| `dumbbell-row` | Lats, upper back | Biceps, rear delts | Growth for elbow flexors [20], row inference [21]. Torso support changes bracing demand. |
| `seated-cable-row` | Upper back, lats | Biceps, rear delts | Acute [21], elbow-flexor growth inference [20]. Elbow path and grip change emphasis. |
| `chest-supported-row` | Upper back | Lats, rear delts, biceps | Row inference [20, 21]. Retain conservative lat credit; support alone does not prove less lat stimulus. |
| `machine-row` | Upper back, lats | Biceps, rear delts | Row inference [20, 21]; different machine paths can emphasize different targets. |
| `inverted-row` | Upper back | Lats, biceps, rear delts | Row-mechanics inference [20, 21]. Retain conservative lat credit; body angle and elbow path matter. |
| `leg-extension` | Quads | None | Growth [5]; includes rectus femoris, which responds differently from the vasti in leg presses. |
| `seated-leg-curl` | Hamstrings | None | Growth [22]. Longer hamstring position does not warrant a credit above 100%. |
| `lying-leg-curl` | Hamstrings | None | Growth [22]. Lower growth than seated curls in that trial does not make these indirect sets. |
| `standing-calf-raise` | Calves | None | Growth [23]; includes gastrocnemius and soleus, not identical regional stimulus. |
| `seated-calf-raise` | Calves | None | Growth [23]; mostly a soleus choice. The broad calf label hides regional differences. |
| `hip-abduction` | Glutes | None | Growth for hip-abduction training [27]; transfer to the unspecified catalogue machine is inference. |
| `hip-adduction` | Adductors | None | Direct joint-action inference; no exercise-specific percentage calibration located. |
| `cable-glute-kickback` | Glutes | Hamstrings | Acute [9]; assumes mostly extended knee, not a bent-knee glute isolation variation. |
| `hip-thrust` | Glutes | None | Growth [4]; hamstring credit removed for the standard bent-knee version. |
| `glute-bridge` | Glutes | None | Conservative inference [4]; standard bent-knee bridge, not a straight-knee hamstring bridge. |
| `dumbbell-fly` | Chest | Front delts | Acute [12, 13]; horizontal-adduction assistance, not a measured half-set. |
| `cable-fly` | Chest | Front delts | Horizontal-adduction inference [12, 13]; cable direction matters. |
| `pec-deck` | Chest | Front delts | Horizontal-adduction inference [12, 13]; machine geometry matters. |
| `lateral-raise` | Side delts | Traps | Acute [12, 18]; trap assistance assumes normal scapular upward rotation. |
| `cable-lateral-raise` | Side delts | Traps | Inference [12, 18]; changing resistance profile does not establish a different fraction. |
| `front-raise` | Front delts | None | Shoulder-flexion inference [12]; no extra supporting-muscle credit established. |
| `reverse-fly` | Rear delts | Upper back | Acute posterior-delt evidence [18], scapular-retraction inference. |
| `reverse-pec-deck` | Rear delts | Upper back | Inference from reverse-fly mechanics [18]; scapular motion changes back involvement. |
| `barbell-curl` | Biceps | Forearms | Acute [16]; forearm credit represents brachioradialis elbow flexion. |
| `dumbbell-curl` | Biceps | Forearms | Growth for elbow flexors [20], acute for brachioradialis [16]. |
| `hammer-curl` | Biceps | Forearms | Acute neutral-grip evidence [16]. Neutral grip does not establish a universal multiplier over supinated curls. |
| `preacher-curl` | Biceps | Forearms | Elbow-flexion inference [16, 20]; shoulder position changes the loading profile. |
| `cable-curl` | Biceps | Forearms | Elbow-flexion inference [16, 20]; resistance profile does not calibrate the forearm fraction. |
| `triceps-pushdown` | Triceps | None | Growth in neutral-arm cable extensions [24]. |
| `overhead-triceps-extension` | Triceps | None | Growth [24]; regional growth differences do not change the direct-set credit. |
| `skull-crusher` | Triceps | None | Growth in lying triceps extensions [11]. |
| `triceps-kickback` | Triceps | None | Elbow-extension inference [11, 24]; shortened-position work remains direct triceps work. |
| `straight-arm-pulldown` | Lats | None | Shoulder-extension inference; do not infer a biceps credit from bent-arm pulldowns. |
| `dumbbell-pullover` | Lats | Chest | Acute evidence for both muscles [28, 29]. Retain existing targets pending stronger growth/technique evidence; the primary/secondary ranking is uncertain. |
| `shrug` | Traps | None | Acute [18]. No default forearm credit for holding the dumbbells. |
| `crunch` | Abs | None | Direct trunk-flexion inference. Oblique activity alone does not establish a default fractional credit. |
| `cable-crunch` | Abs | None | Loaded trunk-flexion inference; assumes spinal flexion rather than a hip hinge. |

## Remaining uncertainty and saved exercises

Primary/secondary choices still depend on technique. The existing front-squat, leg-press, chest-supported-row and inverted-row credits are conservative defaults, not evidence that those exercises necessarily provide less glute or lat stimulus. Generic names do not specify enough technique to justify replacing them with more precise values. Major isometric loading of spinal extensors in hinges/unsupported rows and traps in deadlifts retains existing credits; these are particularly uncertain growth estimates. Removing a quarter-set bracing credit elsewhere does not resolve that uncertainty.

The pullover studies show chest participation, and one barbell study reported greater chest than lat EMG [28]. That does not establish which muscle grows more, or justify swapping their percentages. The barbell/dumbbell comparison helps with equipment transfer [29] but provides no longitudinal calibration. Keep both targets and treat the ranking as unresolved.

Muscle groups are coarse. A curl's forearm credit does not represent every wrist/finger muscle; a leg press does not train every quadriceps head equally; seated and standing calf raises do not train each calf muscle equally. This review preserves the existing vocabulary rather than introducing new muscle subdivisions.

These changes update the bundled catalogue. A saved exercise with its own `muscles` array continues to use its own primary/secondary values. A library-linked exercise without that array follows the updated catalogue through `targets()`. Saved records, custom percentages, workout logs and synchronization events are not rewritten. Historical set totals can change for exercises that still follow catalogue targets, because totals resolve targets at calculation time. This review does not migrate saved copies or deploy a new application build.

## Sources

The sources support muscle roles or the counting method described above. None supplies a validated table of exercise-specific partial-set percentages.

1. [Pelland et al., The Resistance Training Dose Response (2026)](https://pubmed.ncbi.nlm.nih.gov/41343037/). Meta-regression of 67 studies; indirect-set counting compared at zero, half and full credit.
2. [Vigotsky et al., Longing for a Longitudinal Proxy (2022)](https://pubmed.ncbi.nlm.nih.gov/35006527/). Explains why acute EMG amplitude is not a validated predictor of hypertrophy.
3. [Kubo et al., Effects of squat training with different depths on lower limb muscle volumes (2019)](https://pubmed.ncbi.nlm.nih.gov/31230110/). MRI squat training study; depth affected glute and adductor growth.
4. [Plotkin et al., Hip thrust and back squat training elicit similar gluteus muscle hypertrophy (2023)](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full). Nine-week MRI study; gluteal growth with little hamstring growth.
5. [Kinoshita et al., Hypertrophic Effects of Single- versus Multi-Joint Exercise: Knee Extension and Leg Press (2026)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13215645/). MRI study; leg presses grew vasti, gluteus maximus and adductor magnus; rectus femoris responded mainly to extensions.
6. [An electromyographic and kinetic comparison of conventional and Romanian deadlifts (2018)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6323186/). Acute joint-torque and muscle-excitation comparison.
7. [Biomechanical analysis of conventional and sumo deadlift (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12148905/). Acute comparison; stance and movement phase affect recruitment.
8. [Hamstrings Muscle Architecture and Morphology Following an Eccentrically Biased Romanian Deadlift or Nordic Hamstring Intervention (2025)](https://pubmed.ncbi.nlm.nih.gov/40085810/). Six-week hamstring training study; not whole posterior-chain credit calibration.
9. [Muscle Activation Patterns Among Six Hip Extension and Knee Flexion Exercises in Trained Women (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9362892/). Acute gluteus maximus/biceps femoris comparisons including RDLs, step-ups and cable kickbacks.
10. [Electromyographic Examination of Hip and Knee Extension Hex Bar Exercises (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9022700/). Starting knee and torso angles alter quad/hamstring/back emphasis.
11. [Brandao et al., Varying the Order of Single- and Multi-Joint Exercises (2020)](https://pubmed.ncbi.nlm.nih.gov/32149887/). Chest/triceps growth from bench presses and lying triceps extensions; triceps regions respond differently.
12. [Different Shoulder Exercises Affect the Activation of Deltoid Portions (2020)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7706677/). Acute bench press, dumbbell fly, shoulder press and lateral-raise comparison.
13. [Influence of Exercise Order on Electromyographic Activity During Upper Body Resistance Training (2015)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4327372/). Chest/front-delt/triceps EMG during presses, flies, raises and extensions.
14. [Influence of bench angle on upper extremity muscular activation during bench press (2015)](https://pubmed.ncbi.nlm.nih.gov/25799093/). Acute study; angle and movement phase affect excitation.
15. [Low-load bench press and push-up induce similar muscle hypertrophy and strength gain (2018)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5812864/). Training study measuring chest and triceps thickness.
16. [Coratella et al., Biceps Brachii and Brachioradialis Excitation in Biceps Curl Exercise (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10054060/). Acute comparison of supinated, neutral and pronated handgrips.
17. [McAllister et al., Effect of grip width on electromyographic activity during the upright row (2013)](https://pubmed.ncbi.nlm.nih.gov/22362088/). Acute comparison in 16 trained men; wider grips changed delt/trap/biceps recruitment.
18. [Andersen et al., Muscle activation during selected strength exercises in women with chronic neck muscle pain (2008)](https://portal.findresearcher.sdu.dk/en/publications/muscle-activation-during-selected-strength-exercises-in-women-wit/). Acute study in 12 women; includes shrugs, lateral raises, upright rows and reverse flies. Population limits transfer.
19. [Youdas et al., Surface electromyographic activation patterns during pull-ups and chin-ups (2010)](https://pubmed.ncbi.nlm.nih.gov/21068680/). Acute comparison; grip affects biceps and scapular-muscle recruitment.
20. [Mannarino et al., Single-Joint Exercise Results in Higher Hypertrophy of Elbow Flexors Than Multijoint Exercise (2021)](https://doi.org/10.1519/JSC.0000000000003234). Eight-week comparison of dumbbell curls and rows; supports distinguishing direct and assisting elbow-flexor work, not calculating a universal fraction from their growth ratio.
21. [Padovan et al., High-Density Surface EMG in Narrow versus Wide Grip Seated Rows (2025)](https://jhk.termedia.pl/High-Density-Surface-Electromyography-Excitation-of-Prime-Movers-in-the-Narrow-vs%2C209550%2C0%2C2.html). Acute study; grip changes lat/scapular-muscle emphasis.
22. [Maeo et al., Greater Hamstrings Muscle Hypertrophy after Training at Long versus Short Muscle Lengths (2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7969179/). Seated/prone leg-curl training; both train hamstrings directly.
23. [Kinoshita et al., Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training (2023)](https://doi.org/10.3389/fphys.2023.1272106). MRI study; regional responses differ within the calf group.
24. [Maeo et al., Triceps hypertrophy after overhead versus neutral-arm elbow extension training (2023)](https://doi.org/10.1080/17461391.2022.2100279). MRI study; direct triceps work in both positions, with different growth outcomes.
25. [Gullett et al., A biomechanical comparison of back and front squats (2009)](https://pubmed.ncbi.nlm.nih.gov/19002072/). Acute comparison; does not validate a fixed glute fraction for either squat.
26. [Fatigue Increases Muscle Activations but Does Not Change Maximal Joint Angles during the Bar Dip (2022)](https://doi.org/10.3390/ijerph192114390). Acute muscle-excitation study of parallel-bar dips.
27. [Regional Hypertrophy of the Gluteal Muscles Is Task-Specific: Hip Extension versus Hip Abduction Training (2026)](https://pubmed.ncbi.nlm.nih.gov/42842490/). Ten-week MRI study; gluteal regions respond differently to the two tasks.
28. [Marchetti and Uchida, Effects of the pullover exercise on the pectoralis major and latissimus dorsi (2011)](https://pubmed.ncbi.nlm.nih.gov/21975179/). Acute barbell-pullover comparison; does not establish a hypertrophy ranking.
29. [The Use of Barbell or Dumbbell Does Not Affect Muscle Activation During Pullover Exercise (2017)](https://doi.org/10.1590/1517-869220172305166571). Acute equipment comparison; no longitudinal partial-set calibration.
