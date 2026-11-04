/* IntuCode Library — audio and DSP parts. Written from the published formulas credited in each part's
 * "source:" lines; no code is taken from GPL projects (Ardour, Audacity, LMMS, Surge). See README.md. */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

`part: gain-db
title: Gain in decibels
group: audio
types: daw, audio-plugin, audio-tool, broadcast, video-streaming
about: Turn a level in decibels into the number samples are multiplied by, and back.
summary: Faders, trims and meters speak decibels because hearing works more like a log scale: each 6 dB is about double or half. Code multiplies samples by a plain number, the gain, so it converts with gain = 10^(dB / 20) and dB = 20 × log10(gain). Silence has no level in decibels (it would be minus infinity), so the way back stops at a floor.
learn: Powers of ten and logarithms; why -6 dB is about half the level and +6 dB about double.
source: Decibel (amplitude ratios) | https://en.wikipedia.org/wiki/Decibel | 20 × log10 for amplitude ratios, 10 × log10 for power
== python gain.py
define gain from db using db
    description: The multiplier for a level in decibels: 0 dB is 1, -6 dB is about 0.5.
    give back 10 ** (db divided by 20)

define db from gain using gain, floor_db=-120.0
    description: The level of a multiplier in decibels. Silence has no level, so anything quieter than floor_db is floor_db.
    if gain is at most 0
        give back floor_db
    give back max(floor_db, 20 times math.log10(gain))

define apply gain using samples, db
    description: A new list of samples, each one made louder or quieter by db decibels.
    set g to the result of gain from db with db
    create list out
    for each s in samples
        add s times g to out
    give back out
== js gain.js
define gainFromDb using db
    description: The multiplier for a level in decibels: 0 dB is 1, -6 dB is about 0.5.
    give back Math.pow(10, db / 20)
define dbFromGain using gain, floorDb
    description: The level of a multiplier in decibels, never below floorDb (silence has no level): try -120.
    if gain is at most 0
        give back floorDb
    give back Math.max(floorDb, 20 * Math.log10(gain))
define applyGain using samples, db
    description: Changes a Float32Array of samples in place by db decibels.
    constant g is gainFromDb(db)
    repeat length of samples times counting with i
        set item i of samples to item i of samples times g
    give back samples
== cpp gain.cpp
include cmath

define gain_from_db using float db giving back float
    note: 0 dB is 1, -6 dB is about 0.5, -20 dB is 0.1.
    give back std::pow(10.0f, db / 20.0f)

define db_from_gain using float gain giving back float
    note: Silence has no level in decibels, so anything at or below -120 dB is -120.
    if gain is at most 0.000001f
        give back -120.0f
    give back 20.0f * std::log10(gain)

define apply_gain using float* samples, int count, float gain giving back nothing
    note: The gain is worked out once, before the loop, so the loop only multiplies. No memory is made and nothing waits, so it is safe on the audio thread.
    repeat count times counting with i
        set samples[i] to samples[i] * gain`,

`part: pan-law
title: Pan laws
group: audio
types: daw, audio-plugin, broadcast
about: Place a mono sound between left and right without it getting louder or quieter in the middle.
summary: Panning splits one signal into a left and a right gain. With a straight line (linear, -6 dB in the middle) a sound panned centre sounds quieter than at the sides; a sine and cosine curve (constant power, -3 dB in the middle) keeps the total power the same wherever it is. DAWs offer both, and some offer -4.5 dB, the halfway point. The pan here goes from -1 (left) to +1 (right).
learn: Sine and cosine as a quarter turn; the difference between level (amplitude) and power (amplitude squared).
source: Panning law | https://en.wikipedia.org/wiki/Panning_law | the linear and constant-power curves and their centre levels
== python pan.py
define constant power pan using pan
    description: Left and right gains for pan -1 (left) to +1 (right). Both are about 0.707 (-3 dB) in the middle, and left² + right² is always 1.
    set angle to (pan plus 1) times math.pi divided by 4
    give back math.cos(angle), math.sin(angle)

define linear pan using pan
    description: Left and right gains that add up to 1: 0.5 each (-6 dB) in the middle.
    give back (1 minus pan) divided by 2, (1 plus pan) divided by 2

define pan mono using samples, pan
    description: A mono list of samples as two lists, left and right, panned with the constant-power law.
    set gains to the result of constant power pan with pan
    set left_gain to item 0 of gains
    set right_gain to item 1 of gains
    create list left
    create list right
    for each s in samples
        add s times left_gain to left
        add s times right_gain to right
    give back left, right
== js pan.js
define constantPowerPan using pan
    description: Left and right gains for pan -1 to +1; about 0.707 each in the middle.
    constant angle is (pan + 1) * Math.PI / 4
    give back [Math.cos(angle), Math.sin(angle)]
define linearPan using pan
    description: Left and right gains that add up to 1; 0.5 each in the middle.
    give back [(1 - pan) / 2, (1 + pan) / 2]
== cpp pan.cpp
include cmath
include numbers

define constant_power_pan using float pan, float& left, float& right giving back nothing
    note: pan goes from -1 (left) to +1 (right). Both gains are about 0.707 (-3 dB) in the middle.
    set double angle to (pan + 1.0) * std::numbers::pi / 4.0
    set left to std::cos(angle)
    set right to std::sin(angle)

define pan_block using const float* mono, float* left, float* right, int count, float pan giving back nothing
    note: The gains are worked out once per block, not once per sample: the loop only multiplies, which is what an audio callback should do.
    set float left_gain to 0.0f
    set float right_gain to 0.0f
    run constant_power_pan with pan, left_gain, right_gain
    repeat count times counting with i
        set left[i] to mono[i] * left_gain
        set right[i] to mono[i] * right_gain`,

`part: mix-bus
title: Summing tracks with headroom
group: audio
types: daw, broadcast, audio-tool
about: Add several tracks into one mix, each at its own level, and leave room so the sum doesn't clip.
summary: A mix bus adds tracks together sample by sample. Two full-level tracks can add up to twice full scale, which clips when it's turned into whole numbers for a file or a converter, so mixers keep headroom: the bus is turned down a few dB, and the result is checked for overs. Floating-point audio can go above 1.0 inside the mix without harm; it's the last step that has to fit.
learn: Lists of lists; why adding signals adds their levels; what clipping does to a waveform.
== python mix.py
define mix tracks using tracks, gains_db, headroom_db=-6.0
    description: Adds tracks (lists of samples) together, each at its gain in dB, then turns the sum down by the headroom. Shorter tracks count as silence at their end. Gives back the mix and how many samples went over full scale.
    set longest to max(len(t) for t in tracks)
    set bus gain to 10 ** (headroom_db divided by 20)
    create list mix
    repeat longest times
        add 0.0 to mix
    count k from 0 to length of tracks minus 1
        set g to 10 ** (item k of gains_db divided by 20) times bus gain
        set track to item k of tracks
        count i from 0 to length of track minus 1
            set item i of mix to item i of mix plus item i of track times g
    set overs to 0
    for each s in mix
        if abs(s) is more than 1.0
            increase overs
    give back mix, overs
== cpp mix.cpp
include cmath
include vector

define mix_into using const std::vector<const float*>& tracks, const std::vector<float>& gains, float* out, int count giving back int
    note: Adds each track, at its gain (a multiplier, worked out from dB before audio starts), into out. Gives back how many samples went over full scale. Nothing here makes memory or waits, so it can run on the audio thread.
    repeat count times counting with i
        set out[i] to 0.0f
    set int overs to 0
    repeat static_cast<int>(tracks.size()) times counting with k
        set const float* track to tracks[k]
        set float g to gains[k]
        repeat count times counting with i
            set out[i] to out[i] + track[i] * g
    repeat count times counting with i
        if std::abs(out[i]) is more than 1.0f
            increase overs
    give back overs`,

`part: peak-meter
title: Peak meter with ballistics
group: audio
types: daw, audio-plugin, broadcast, video-streaming, audio-tool
about: A level meter that rises at once, falls back gently and holds the highest peak for a moment.
summary: A meter shows the loudest sample in each block, in dB. Read raw, it flickers too fast to see, so meters have ballistics: an instant attack (it jumps up to every peak), a release that falls a set number of dB per second, and a peak hold that keeps the highest reading for a second or two. Broadcast meters follow standards with their own timings (IEC 60268-10 for PPMs, IEC 60268-17 for VU); the numbers here are settings, not one of those standards.
learn: Absolute value; decibels; why a meter works on blocks and not single samples.
source: IEC 60268-10 (peak programme meters) | https://webstore.iec.ch/en/publication/1222 | the idea of separate rise, fall and hold behaviour
== python meter.py
define class PeakMeter
    description: A peak meter with ballistics: up at once, down at fall_db_per_second, and a held peak.
    define __init__ using self, sample_rate, fall_db_per_second=20.0, hold_seconds=1.5
        set self.sample_rate to sample_rate
        set self.fall to fall_db_per_second
        set self.hold to hold_seconds
        set self.level_db to -120.0
        set self.peak_db to -120.0
        set self.held_for to 0.0

    define update using self, block
        description: Reads one block of samples; gives back the level and the held peak, in dB.
        set seconds to length of block divided by self.sample_rate
        set loudest to 0.0
        for each s in block
            set loudest to max(loudest, abs(s))
        set block_db to 20 times math.log10(max(loudest, 0.000001))
        note: Attack: up at once. Release: down at a fixed number of dB per second.
        if block_db is more than self.level_db
            set self.level_db to block_db
        otherwise
            set self.level_db to max(block_db, self.level_db minus self.fall times seconds)
        note: Peak hold: the highest reading stays for hold seconds, then falls too.
        if block_db is at least self.peak_db
            set self.peak_db to block_db
            set self.held_for to 0.0
        otherwise
            increase self.held_for by seconds
            if self.held_for is more than self.hold
                set self.peak_db to max(self.level_db, self.peak_db minus self.fall times seconds)
        give back self.level_db, self.peak_db
== js meter.js
define createPeakMeter using sampleRate, fallDbPerSecond, holdSeconds
    description: A peak meter's state: its level and held peak in dB. Try a fall of 20 dB a second and a hold of 1.5 seconds.
    give back { sampleRate: sampleRate, fall: fallDbPerSecond, hold: holdSeconds, levelDb: -120, peakDb: -120, heldFor: 0 }
define updatePeakMeter using meter, block
    description: Reads one block (a Float32Array, like an AnalyserNode's getFloatTimeDomainData gives) and moves the meter.
    constant seconds is block.length / meter.sampleRate
    set loudest to 0
    for each s in block
        set loudest to Math.max(loudest, Math.abs(s))
    constant blockDb is 20 * Math.log10(Math.max(loudest, 0.000001))
    if blockDb is more than meter.levelDb
        set meter.levelDb to blockDb
    otherwise
        set meter.levelDb to Math.max(blockDb, meter.levelDb - meter.fall * seconds)
    if blockDb is at least meter.peakDb
        set meter.peakDb to blockDb
        set meter.heldFor to 0
    otherwise
        set meter.heldFor to meter.heldFor + seconds
        if meter.heldFor is more than meter.hold
            set meter.peakDb to Math.max(meter.levelDb, meter.peakDb - meter.fall * seconds)
    give back meter
== cpp meter.cpp
include cmath
include atomic
include algorithm

define class PeakMeter
    field level_db: float = -120.0f
    field fall_per_sample: float = 0.0f
    note: The screen reads shown_db from another thread, so it is atomic: reading it never waits and never sees half a value.
    field shown_db: std::atomic<float> = -120.0f
    define prepare using float sample_rate, float fall_db_per_second giving back nothing
        set self.fall_per_sample to fall_db_per_second / sample_rate
    define process using const float* samples, int count giving back nothing
        note: Runs on the audio thread: no memory is made, nothing locks or waits, so it never holds up the sound.
        set float loudest to 0.0f
        repeat count times counting with i
            set loudest to std::max(loudest, std::abs(samples[i]))
        set float block_db to 20.0f * std::log10(std::max(loudest, 0.000001f))
        set float fallen to level_db - fall_per_sample * count
        set self.level_db to std::max(block_db, fallen)
        run shown_db.store with level_db, std::memory_order_relaxed`,

`part: rms-meter
title: RMS meter
group: audio
types: daw, broadcast, audio-tool
about: A meter that follows the average power of a signal, closer to how loud it sounds than the peaks.
summary: RMS (root mean square) squares each sample, averages the squares and takes the square root, so it measures power rather than the highest sample. A running average with a time constant, around 300 ms here, makes it move smoothly; that is close to the integration time of a VU meter. A full-scale sine wave reads -3 dB RMS, because its average power is half its peak power.
learn: Squares and square roots; averages; a running (exponential) average.
source: Root mean square | https://en.wikipedia.org/wiki/Root_mean_square | RMS of a sine is its peak divided by √2
== python rms.py
define class RmsMeter
    description: An RMS meter with an exponential average; time_constant is in seconds.
    define __init__ using self, sample_rate, time_constant=0.3
        set self.keep to math.exp(-1 divided by (time_constant times sample_rate))
        set self.mean_square to 0.0

    define update using self, block
        description: Reads one block of samples; gives back the RMS level in dB.
        for each s in block
            set self.mean_square to self.keep times self.mean_square plus (1 minus self.keep) times s times s
        give back 10 times math.log10(max(self.mean_square, 1e-12))
== cpp rms.cpp
include cmath
include algorithm

define class RmsMeter
    field keep: float = 0.0f
    field mean_square: float = 0.0f
    define prepare using float sample_rate, float time_constant giving back nothing
        note: Worked out once, before audio starts: exp() is too slow to call for every sample.
        set self.keep to std::exp(-1.0f / (time_constant * sample_rate))
    define process using const float* samples, int count giving back float
        note: Safe on the audio thread: only arithmetic. Gives back the level in dB.
        repeat count times counting with i
            set self.mean_square to keep * mean_square + (1.0f - keep) * samples[i] * samples[i]
        give back 10.0f * std::log10(std::max(mean_square, 1e-12f))`,

`part: loudness-meter
title: Loudness meter (LUFS)
group: audio
types: broadcast, video-streaming, audio-tool, daw
about: Momentary loudness in LUFS, as broadcast and streaming loudness rules measure it.
summary: ITU-R BS.1770 measures loudness by first filtering with K-weighting (a high shelf that models the head, then a high-pass that ignores rumble), then taking the mean square over 400 ms: loudness = -0.691 + 10 × log10(mean square), in LUFS. EBU R 128 targets -23 LUFS for broadcast. This is the momentary value for one channel at 48 kHz; integrated loudness adds gating over the whole programme, and other sample rates need their own filter coefficients.
learn: Biquad filters (see the Biquad part); mean square; what the gating in BS.1770 adds.
source: ITU-R BS.1770 | https://www.itu.int/rec/R-REC-BS.1770 | the K-weighting coefficients at 48 kHz, the 400 ms window and the -0.691 offset
source: EBU R 128 | https://tech.ebu.ch/publications/r128 | the -23 LUFS target
== python loudness.py
define k weight using samples
    description: Filters 48 kHz samples with BS.1770's K-weighting: the head-shaped shelf, then the high-pass.
    set stages to [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621]]
    set signal to samples
    for each stage in stages
        set b0 to item 0 of stage
        set b1 to item 1 of stage
        set b2 to item 2 of stage
        set a1 to item 3 of stage
        set a2 to item 4 of stage
        set x1 to 0.0
        set x2 to 0.0
        set y1 to 0.0
        set y2 to 0.0
        create list out
        for each x in signal
            set y to b0 times x plus b1 times x1 plus b2 times x2 minus a1 times y1 minus a2 times y2
            set x2 to x1
            set x1 to x
            set y2 to y1
            set y1 to y
            add y to out
        set signal to out
    give back signal

define momentary loudness using samples
    description: The loudness of the last 400 ms of 48 kHz samples, in LUFS.
    set weighted to the result of k weight with samples
    set recent to weighted[-19200:]
    set mean_square to sum(s times s for s in recent) divided by length of recent
    give back -0.691 plus 10 times math.log10(max(mean_square, 1e-12))
== cpp loudness.cpp
include cmath
include algorithm

define class KWeighting
    note: The two filters of BS.1770's K-weighting at 48 kHz. Coefficients are fixed, so nothing is worked out on the audio thread.
    field s1: double = 0.0
    field s2: double = 0.0
    field t1: double = 0.0
    field t2: double = 0.0
    define process using double x giving back double
        note: Transposed direct form II: two state values per filter.
        set double y to 1.53512485958697 * x + s1
        set self.s1 to -2.69169618940638 * x + 1.69065929318241 * y + s2
        set self.s2 to 1.19839281085285 * x - 0.73248077421585 * y
        set double z to y + t1
        set self.t1 to -2.0 * y + 1.99004745483398 * z + t2
        set self.t2 to y - 0.99007225036621 * z
        give back z

define class MomentaryLoudness
    field filter: KWeighting
    field mean_square: double = 0.0
    field keep: double = 0.0
    define prepare using double sample_rate giving back nothing
        note: A running average with a 400 ms time constant: no history to store, and close to BS.1770's 400 ms block. A meter that must match the standard exactly keeps the last 400 ms of squares instead.
        set self.keep to std::exp(-1.0 / (0.4 * sample_rate))
    define process using const float* samples, int count giving back double
        note: Safe on the audio thread: arithmetic only. Gives back LUFS.
        repeat count times counting with i
            set double k to filter.process(samples[i])
            set self.mean_square to keep * mean_square + (1.0 - keep) * k * k
        give back -0.691 + 10.0 * std::log10(std::max(mean_square, 1e-12))`,

`part: biquad
title: Biquad filters (EQ)
group: audio
types: daw, audio-plugin, audio-tool, broadcast, music-tool
about: The building block of EQs: low-pass, high-pass, peaking and shelving filters from the Audio EQ Cookbook.
summary: A biquad mixes the current sample with the last two inputs and the last two outputs, using five numbers. Robert Bristow-Johnson's Audio EQ Cookbook gives those numbers for each kind of filter from a frequency, a Q (how narrow) and, for peaks and shelves, a gain in dB. Nearly every EQ, crossover and tone control is made of these. Work the numbers out when a setting changes, never on every sample.
learn: Frequency, sample rate and Nyquist (half the sample rate); what Q means; how a filter remembers past samples.
source: Audio EQ Cookbook (W3C Working Group Note) | https://www.w3.org/TR/audio-eq-cookbook/ | the coefficient formulas for each filter type
== python biquad.py
define biquad coefficients using kind, frequency, q, sample_rate, gain_db=0.0
    description: The numbers for a biquad, from the Audio EQ Cookbook, already divided by a0. kind is "low-pass", "high-pass", "peaking", "low shelf" or "high shelf"; gain_db is for the last three.
    set w0 to 2 times math.pi times frequency divided by sample_rate
    set cos w0 to math.cos(w0)
    set alpha to math.sin(w0) divided by (2 times q)
    set A to 10 ** (gain_db divided by 40)
    set root to 2 times square root of A times alpha
    if kind is "low-pass"
        set b0 to (1 minus cos w0) divided by 2
        set b1 to 1 minus cos w0
        set b2 to (1 minus cos w0) divided by 2
        set a0 to 1 plus alpha
        set a1 to -2 times cos w0
        set a2 to 1 minus alpha
    otherwise if kind is "high-pass"
        set b0 to (1 plus cos w0) divided by 2
        set b1 to -(1 plus cos w0)
        set b2 to (1 plus cos w0) divided by 2
        set a0 to 1 plus alpha
        set a1 to -2 times cos w0
        set a2 to 1 minus alpha
    otherwise if kind is "peaking"
        set b0 to 1 plus alpha times A
        set b1 to -2 times cos w0
        set b2 to 1 minus alpha times A
        set a0 to 1 plus alpha divided by A
        set a1 to -2 times cos w0
        set a2 to 1 minus alpha divided by A
    otherwise if kind is "low shelf"
        set b0 to A times ((A plus 1) minus (A minus 1) times cos w0 plus root)
        set b1 to 2 times A times ((A minus 1) minus (A plus 1) times cos w0)
        set b2 to A times ((A plus 1) minus (A minus 1) times cos w0 minus root)
        set a0 to (A plus 1) plus (A minus 1) times cos w0 plus root
        set a1 to -2 times ((A minus 1) plus (A plus 1) times cos w0)
        set a2 to (A plus 1) plus (A minus 1) times cos w0 minus root
    otherwise if kind is "high shelf"
        set b0 to A times ((A plus 1) plus (A minus 1) times cos w0 plus root)
        set b1 to -2 times A times ((A minus 1) plus (A plus 1) times cos w0)
        set b2 to A times ((A plus 1) plus (A minus 1) times cos w0 minus root)
        set a0 to (A plus 1) minus (A minus 1) times cos w0 plus root
        set a1 to 2 times ((A minus 1) minus (A plus 1) times cos w0)
        set a2 to (A plus 1) minus (A minus 1) times cos w0 minus root
    otherwise
        fail with ValueError: "Unknown kind of filter: {kind}"
    give back {"b0": b0 / a0, "b1": b1 / a0, "b2": b2 / a0, "a1": a1 / a0, "a2": a2 / a0}

define run biquad using samples, c
    description: Filters a list of samples with coefficients from biquad coefficients (direct form I: the last two inputs and outputs are kept).
    set x1 to 0.0
    set x2 to 0.0
    set y1 to 0.0
    set y2 to 0.0
    create list out
    for each x in samples
        set y to item "b0" of c times x plus item "b1" of c times x1 plus item "b2" of c times x2 minus item "a1" of c times y1 minus item "a2" of c times y2
        set x2 to x1
        set x1 to x
        set y2 to y1
        set y1 to y
        add y to out
    give back out
== js biquad.js
define biquadCoefficients using kind, frequency, q, sampleRate, gainDb
    description: The numbers for a biquad from the Audio EQ Cookbook, divided by a0. In a page, Web Audio's createBiquadFilter() does the same job for playback.
    constant w0 is 2 * Math.PI * frequency / sampleRate
    constant cosW0 is Math.cos(w0)
    constant alpha is Math.sin(w0) / (2 * q)
    constant A is Math.pow(10, gainDb / 40)
    constant root is 2 * Math.sqrt(A) * alpha
    set b to [0, 0, 0]
    set a to [1, 0, 0]
    if kind is "low-pass"
        set b to [(1 - cosW0) / 2, 1 - cosW0, (1 - cosW0) / 2]
        set a to [1 + alpha, -2 * cosW0, 1 - alpha]
    otherwise if kind is "high-pass"
        set b to [(1 + cosW0) / 2, -(1 + cosW0), (1 + cosW0) / 2]
        set a to [1 + alpha, -2 * cosW0, 1 - alpha]
    otherwise if kind is "peaking"
        set b to [1 + alpha * A, -2 * cosW0, 1 - alpha * A]
        set a to [1 + alpha / A, -2 * cosW0, 1 - alpha / A]
    otherwise if kind is "low shelf"
        set b to [A * ((A + 1) - (A - 1) * cosW0 + root), 2 * A * ((A - 1) - (A + 1) * cosW0), A * ((A + 1) - (A - 1) * cosW0 - root)]
        set a to [(A + 1) + (A - 1) * cosW0 + root, -2 * ((A - 1) + (A + 1) * cosW0), (A + 1) + (A - 1) * cosW0 - root]
    otherwise if kind is "high shelf"
        set b to [A * ((A + 1) + (A - 1) * cosW0 + root), -2 * A * ((A - 1) + (A + 1) * cosW0), A * ((A + 1) + (A - 1) * cosW0 - root)]
        set a to [(A + 1) - (A - 1) * cosW0 + root, 2 * ((A - 1) - (A + 1) * cosW0), (A + 1) - (A - 1) * cosW0 - root]
    otherwise
        fail with "Unknown kind of filter: " + kind
    give back { b0: b[0] / a[0], b1: b[1] / a[0], b2: b[2] / a[0], a1: a[1] / a[0], a2: a[2] / a[0] }
define runBiquad using samples, c
    description: Filters an array of samples (direct form I) and gives back a new Float32Array.
    constant out is new Float32Array(samples.length)
    set x1 to 0
    set x2 to 0
    set y1 to 0
    set y2 to 0
    repeat length of samples times counting with i
        constant x is item i of samples
        constant y is c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
        set x2 to x1
        set x1 to x
        set y2 to y1
        set y1 to y
        set item i of out to y
    give back out
== cpp biquad.cpp
include cmath
include numbers

define class Biquad
    note: Coefficients are worked out in set_* when a knob moves; process() only multiplies and adds, so it is safe on the audio thread. State is double: low frequencies at high sample rates need the precision.
    field b0: double = 1.0
    field b1: double = 0.0
    field b2: double = 0.0
    field a1: double = 0.0
    field a2: double = 0.0
    field s1: double = 0.0
    field s2: double = 0.0
    define set_low_pass using double frequency, double q, double sample_rate giving back nothing
        set double w0 to 2.0 * std::numbers::pi * frequency / sample_rate
        set double alpha to std::sin(w0) / (2.0 * q)
        set double c to std::cos(w0)
        set double a0 to 1.0 + alpha
        set self.b0 to (1.0 - c) / 2.0 / a0
        set self.b1 to (1.0 - c) / a0
        set self.b2 to (1.0 - c) / 2.0 / a0
        set self.a1 to -2.0 * c / a0
        set self.a2 to (1.0 - alpha) / a0
    define set_high_pass using double frequency, double q, double sample_rate giving back nothing
        set double w0 to 2.0 * std::numbers::pi * frequency / sample_rate
        set double alpha to std::sin(w0) / (2.0 * q)
        set double c to std::cos(w0)
        set double a0 to 1.0 + alpha
        set self.b0 to (1.0 + c) / 2.0 / a0
        set self.b1 to -(1.0 + c) / a0
        set self.b2 to (1.0 + c) / 2.0 / a0
        set self.a1 to -2.0 * c / a0
        set self.a2 to (1.0 - alpha) / a0
    define set_peaking using double frequency, double q, double gain_db, double sample_rate giving back nothing
        set double w0 to 2.0 * std::numbers::pi * frequency / sample_rate
        set double alpha to std::sin(w0) / (2.0 * q)
        set double c to std::cos(w0)
        set double big_a to std::pow(10.0, gain_db / 40.0)
        set double a0 to 1.0 + alpha / big_a
        set self.b0 to (1.0 + alpha * big_a) / a0
        set self.b1 to -2.0 * c / a0
        set self.b2 to (1.0 - alpha * big_a) / a0
        set self.a1 to -2.0 * c / a0
        set self.a2 to (1.0 - alpha / big_a) / a0
    define process using float x giving back float
        note: Transposed direct form II: two state values instead of four.
        set double y to b0 * x + s1
        set self.s1 to b1 * x - a1 * y + s2
        set self.s2 to b2 * x - a2 * y
        give back y`,

`part: smoother
title: Parameter smoothing
group: audio
types: daw, audio-plugin, music-tool, broadcast
about: Glide a gain or cutoff to its new value over a few milliseconds instead of jumping, so knobs don't click.
summary: When a fader jumps from one value to another between two samples, the step is heard as a click or "zipper" noise. A one-pole smoother moves a little of the way towards the target on every sample: value = target + k × (value - target), with k = exp(-1 / (time × sample rate)). After one time constant it has covered about 63% of the way; after five, more than 99%.
learn: Exponential decay; why a sudden step in a waveform makes a click.
source: One-pole filter | https://ccrma.stanford.edu/~jos/filters/One_Pole.html | the one-pole low-pass used as a smoother
== python smoother.py
define class Smoother
    description: Moves towards a target a little on every sample. time is the time constant in seconds.
    define __init__ using self, sample_rate, time=0.02, start=0.0
        set self.k to math.exp(-1 divided by (time times sample_rate))
        set self.value to start
        set self.target to start

    define next value using self
        description: The value for the next sample.
        set self.value to self.target plus self.k times (self.value minus self.target)
        give back self.value
== js smoother.js
define createSmoother using sampleRate, time, start
    description: A one-pole smoother's state; time is the time constant in seconds (try 0.02). In Web Audio, an AudioParam's setTargetAtTime does this for you.
    give back { k: Math.exp(-1 / (time * sampleRate)), value: start, target: start }
define nextValue using s
    description: The value for the next sample.
    set s.value to s.target + s.k * (s.value - s.target)
    give back s.value
== cpp smoother.cpp
include cmath
include atomic

define class Smoother
    note: The target is set from the user interface thread and read on the audio thread, so it is atomic: no lock, nothing waits.
    field target: std::atomic<float> = 0.0f
    field value: float = 0.0f
    field k: float = 0.0f
    define prepare using float sample_rate, float time giving back nothing
        set self.k to std::exp(-1.0f / (time * sample_rate))
    define next giving back float
        set float t to target.load(std::memory_order_relaxed)
        set self.value to t + k * (value - t)
        give back value`,

`part: compressor
title: Compressor
group: audio
types: daw, audio-plugin, broadcast, video-streaming
about: Turn loud passages down by a ratio above a threshold, with a soft knee and attack and release times.
summary: A compressor's static curve says how much to turn down: below the threshold nothing, above it the level rises only 1/ratio as fast. A soft knee blends the two over a few dB. Its gain then moves with an attack time (how fast it turns down) and a release time (how fast it lets go), smoothed in dB on the gain reduction itself. Make-up gain brings the level back up afterwards.
learn: Decibels; the gain-reduction curve on paper first; one-pole smoothing (the Parameter smoothing part).
source: Giannoulis, Massberg and Reiss, Digital Dynamic Range Compressor Design: A Tutorial and Analysis (JAES 2012) | https://www.aes.org/e-lib/browse.cfm?elib=16354 | the soft-knee static curve and the smoothed, decoupled attack and release
== python compressor.py
define gain reduction db using level_db, threshold_db, ratio, knee_db
    description: The static curve: how many dB to turn down for a level, with a soft knee knee_db wide (0 for a hard knee).
    set over to level_db minus threshold_db
    if 2 times over is at most -knee_db
        give back 0.0
    if knee_db is more than 0 and 2 times abs(over) is at most knee_db
        set into_knee to over plus knee_db divided by 2
        give back (1 divided by ratio minus 1) times into_knee times into_knee divided by (2 times knee_db)
    give back (1 divided by ratio minus 1) times over

define compress using samples, sample_rate, threshold_db=-18.0, ratio=4.0, knee_db=6.0, attack=0.01, release=0.1, makeup_db=0.0
    description: Compresses a list of samples (peak detection, smoothing on the gain reduction).
    set attack_k to math.exp(-1 divided by (attack times sample_rate))
    set release_k to math.exp(-1 divided by (release times sample_rate))
    set smoothed to 0.0
    set makeup to 10 ** (makeup_db divided by 20)
    create list out
    for each x in samples
        set level_db to 20 times math.log10(max(abs(x), 1e-6))
        set wanted to the result of gain reduction db with level_db, threshold_db, ratio, knee_db
        note: More reduction (a more negative number) follows the attack time; less follows the release time.
        if wanted is less than smoothed
            set smoothed to attack_k times smoothed plus (1 minus attack_k) times wanted
        otherwise
            set smoothed to release_k times smoothed plus (1 minus release_k) times wanted
        add x times 10 ** (smoothed divided by 20) times makeup to out
    give back out
== cpp compressor.cpp
include cmath
include algorithm

define class Compressor
    note: Settings are turned into coefficients in prepare(); process() is arithmetic only, so it is safe on the audio thread.
    field threshold_db: float = -18.0f
    field ratio: float = 4.0f
    field knee_db: float = 6.0f
    field attack_k: float = 0.0f
    field release_k: float = 0.0f
    field smoothed_db: float = 0.0f
    define prepare using float sample_rate, float attack, float release giving back nothing
        set self.attack_k to std::exp(-1.0f / (attack * sample_rate))
        set self.release_k to std::exp(-1.0f / (release * sample_rate))
    define reduction using float level_db giving back float
        set float over to level_db - threshold_db
        if 2.0f * over is at most -knee_db
            give back 0.0f
        if knee_db is more than 0.0f and 2.0f * std::abs(over) is at most knee_db
            set float into_knee to over + knee_db / 2.0f
            give back (1.0f / ratio - 1.0f) * into_knee * into_knee / (2.0f * knee_db)
        give back (1.0f / ratio - 1.0f) * over
    define process using float* samples, int count giving back nothing
        repeat count times counting with i
            set float level_db to 20.0f * std::log10(std::max(std::abs(samples[i]), 0.000001f))
            set float wanted to reduction(level_db)
            set float k to wanted < smoothed_db ? attack_k : release_k
            set self.smoothed_db to k * smoothed_db + (1.0f - k) * wanted
            set samples[i] to samples[i] * std::pow(10.0f, smoothed_db / 20.0f)`,

`part: limiter
title: Limiter
group: audio
types: daw, audio-plugin, broadcast, video-streaming
about: Keep peaks under a ceiling: turn down at once when a sample would go over, and let go slowly.
summary: A limiter is a compressor with an infinite ratio and an instant attack: the gain drops the moment a sample would cross the ceiling, then recovers over the release time. This simple form can still let a very fast peak bend the waveform; mastering and broadcast limiters add look-ahead (a short delay so the gain can start falling before the peak arrives) and measure true peaks between samples.
learn: The Compressor part first; why instant gain changes distort, and what look-ahead buys.
source: Giannoulis, Massberg and Reiss, Digital Dynamic Range Compressor Design (JAES 2012) | https://www.aes.org/e-lib/browse.cfm?elib=16354 | the limiter as a compressor with infinite ratio, and release smoothing
== python limiter.py
define limit using samples, sample_rate, ceiling_db=-1.0, release=0.05
    description: Keeps every sample at or under the ceiling. The gain drops at once and comes back over release seconds.
    set ceiling to 10 ** (ceiling_db divided by 20)
    set release_k to math.exp(-1 divided by (release times sample_rate))
    set gain to 1.0
    create list out
    for each x in samples
        set needed to ceiling divided by abs(x) if abs(x) is more than ceiling otherwise 1.0
        if needed is less than gain
            set gain to needed
        otherwise
            set gain to release_k times gain plus (1 minus release_k) times needed
        add x times gain to out
    give back out
== cpp limiter.cpp
include cmath
include algorithm

define class Limiter
    note: No memory, locks or waiting in process(), so it runs safely in the audio callback.
    field ceiling: float = 0.891f
    field release_k: float = 0.0f
    field gain: float = 1.0f
    define prepare using float sample_rate, float ceiling_db, float release giving back nothing
        set self.ceiling to std::pow(10.0f, ceiling_db / 20.0f)
        set self.release_k to std::exp(-1.0f / (release * sample_rate))
    define process using float* samples, int count giving back nothing
        repeat count times counting with i
            set float level to std::abs(samples[i])
            set float needed to level > ceiling ? ceiling / level : 1.0f
            if needed is less than gain
                set self.gain to needed
            otherwise
                set self.gain to release_k * gain + (1.0f - release_k) * needed
            set samples[i] to samples[i] * gain`,

`part: gate
title: Noise gate
group: audio
types: daw, audio-plugin, broadcast
about: Silence a signal between phrases: open above a threshold, close below a lower one after a hold time.
summary: A gate keeps background noise out of the gaps, for a microphone between lines or a drum between hits. Two thresholds (hysteresis) stop it chattering open and shut on a level that hovers near one value; a hold time keeps it open through short dips; attack and release fade the gain so opening and closing don't click.
learn: Comparing levels in dB; a small state machine (open, holding, closed).
== python gate.py
define gate using samples, sample_rate, open_db=-40.0, close_db=-50.0, hold=0.05, fade=0.005
    description: A noise gate: opens above open_db, closes below close_db once hold seconds have passed. fade is the time constant of the gain, in seconds.
    set open_level to 10 ** (open_db divided by 20)
    set close_level to 10 ** (close_db divided by 20)
    set hold_samples to int(hold times sample_rate)
    set k to math.exp(-1 divided by (fade times sample_rate))
    set is_open to no
    set held to 0
    set gain to 0.0
    create list out
    for each x in samples
        set level to abs(x)
        if level is more than open_level
            set is_open to yes
            set held to 0
        otherwise if is_open and level is less than close_level
            increase held
            if held is more than hold_samples
                set is_open to no
        set target to 1.0 if is_open otherwise 0.0
        set gain to target plus k times (gain minus target)
        add x times gain to out
    give back out
== cpp gate.cpp
include cmath

define class Gate
    note: State is a few numbers; process() never makes memory or waits, so it is safe on the audio thread.
    field open_level: float = 0.01f
    field close_level: float = 0.00316f
    field hold_samples: int = 2400
    field k: float = 0.0f
    field is_open: bool = false
    field held: int = 0
    field gain: float = 0.0f
    define prepare using float sample_rate, float hold, float fade giving back nothing
        set self.hold_samples to static_cast<int>(hold * sample_rate)
        set self.k to std::exp(-1.0f / (fade * sample_rate))
    define process using float* samples, int count giving back nothing
        repeat count times counting with i
            set float level to std::abs(samples[i])
            if level is more than open_level
                set self.is_open to true
                set self.held to 0
            otherwise if is_open and level is less than close_level
                increase held
                if held is more than hold_samples
                    set self.is_open to false
            set float target to is_open ? 1.0f : 0.0f
            set self.gain to target + k * (gain - target)
            set samples[i] to samples[i] * gain`,

`part: delay-line
title: Delay line
group: audio
types: daw, audio-plugin, music-tool, broadcast
about: An echo: a circular buffer that plays the sound back later, with feedback and a wet/dry mix.
summary: A delay line keeps the last few seconds of samples in a buffer that wraps round (a circular buffer), writing at one place and reading a set distance behind it. Feeding some of the output back in makes repeats that fade away; keep feedback under 1 or they grow forever. Reading between two samples (linear interpolation) lets the delay time change smoothly, which is how chorus and flanger effects work. The buffer is made before audio starts and never resized.
learn: Lists used as a circle with the remainder (%); interpolation between two values.
source: Delay-line interpolation (J. O. Smith, Physical Audio Signal Processing) | https://ccrma.stanford.edu/~jos/pasp/Delay_Line_Interpolation.html | reading a fractional delay with linear interpolation
== python delay.py
define echo using samples, sample_rate, delay_seconds=0.25, feedback=0.4, mix=0.3
    description: Adds an echo to a list of samples. The delay can be a fraction of a sample.
    set size to int(delay_seconds times sample_rate) plus 2
    set buffer to [0.0] * size
    set write to 0
    set delay to delay_seconds times sample_rate
    create list out
    for each x in samples
        note: Read delay samples behind the write position, between two stored samples.
        set read to (write minus delay) mod size
        set i to int(read)
        set frac to read minus i
        set delayed to item i of buffer times (1 minus frac) plus item ((i plus 1) mod size) of buffer times frac
        set item write of buffer to x plus delayed times feedback
        set write to (write plus 1) mod size
        add x times (1 minus mix) plus delayed times mix to out
    give back out
== cpp delay.cpp
include cmath
include vector

define class DelayLine
    note: The buffer is made in prepare(), before audio starts. process() only reads and writes it, never resizes it, so the audio thread never waits for memory.
    field buffer: std::vector<float>
    field write: int = 0
    define prepare using double sample_rate, double max_seconds giving back nothing
        set int length to static_cast<int>(max_seconds * sample_rate) + 2
        run buffer.assign with length, 0.0f
        set self.write to 0
    define process using float x, float delay_samples, float feedback, float mix giving back float
        set int size to static_cast<int>(buffer.size())
        set float read to write - delay_samples
        if read is less than 0.0f
            set read to read + size
        set int i to static_cast<int>(read)
        set float frac to read - i
        set float delayed to buffer[i] * (1.0f - frac) + buffer[(i + 1) % size] * frac
        set buffer[write] to x + delayed * feedback
        set self.write to (write + 1) % size
        give back x * (1.0f - mix) + delayed * mix`,

`part: crossfade
title: Equal-power crossfade
group: audio
types: daw, audio-tool, broadcast, video-streaming, music-tool
about: Fade one sound out while another fades in, without a dip in loudness halfway.
summary: Fading two different sounds with straight lines (linear) makes a dip in the middle, because unrelated signals add by power, not by level. An equal-power fade uses a quarter of a cosine for the outgoing sound and a quarter of a sine for the incoming one, so out² + in² is always 1. For two copies of the same sound (a loop's join), a linear fade is right instead, because identical signals add by level.
learn: Sine and cosine; why two unrelated signals add by power.
source: Equal-power crossfade | https://en.wikipedia.org/wiki/Fade_(audio_engineering) | the sine and cosine fade curves
== python crossfade.py
define equal power gains using position
    description: Gains for the outgoing and incoming sounds, position from 0 (all out) to 1 (all in).
    set angle to position times math.pi divided by 2
    give back math.cos(angle), math.sin(angle)

define crossfade using outgoing, incoming
    description: Fades from one list of samples into another over their length (the shorter one).
    set n to min(len(outgoing), len(incoming))
    create list out
    count i from 0 to n minus 1
        set gains to the result of equal power gains with i divided by max(n minus 1, 1)
        add item i of outgoing times item 0 of gains plus item i of incoming times item 1 of gains to out
    give back out
== js crossfade.js
define equalPowerGains using position
    description: Gains for the outgoing and incoming sounds, position from 0 to 1. With Web Audio, set two GainNodes to these.
    constant angle is position * Math.PI / 2
    give back [Math.cos(angle), Math.sin(angle)]
== cpp crossfade.cpp
include cmath
include numbers

define crossfade using const float* outgoing, const float* incoming, float* out, int count giving back nothing
    note: One block of samples: safe in an audio callback (arithmetic only).
    repeat count times counting with i
        set float position to count > 1 ? i / (count - 1.0f) : 1.0f
        set double angle to position * std::numbers::pi / 2.0
        set out[i] to outgoing[i] * std::cos(angle) + incoming[i] * std::sin(angle)`,

`part: waveshaper
title: Waveshaper transfer functions
group: audio
types: audio-plugin, daw, music-tool
about: Saturation and distortion: bend the waveform with a curve that maps each input level to an output level.
summary: A waveshaper passes every sample through a fixed curve, its transfer function. A straight line changes nothing; a curve that flattens near the top rounds off peaks and adds harmonics. tanh is smooth all the way; the cubic soft clipper x - x³/3 is cheap and flat at ±1; a hard clip cuts straight across and sounds harsh. Drive (gain before the curve) sets how hard it bends. Curves add new high frequencies, which can alias: plug-ins often run them at a higher sample rate (oversampling).
learn: Functions as curves (plot them); why flattening a waveform adds harmonics; aliasing.
source: Cubic soft clipper (J. O. Smith, Physical Audio Signal Processing) | https://ccrma.stanford.edu/~jos/pasp/Soft_Clipping.html | f(x) = x - x³/3 for |x| ≤ 1, ±2/3 outside
== python shaper.py
define soft clip using x
    description: The cubic soft clipper, scaled to reach ±1: smooth up to the top, then flat.
    if x is at least 1
        give back 1.0
    if x is at most -1
        give back -1.0
    give back 1.5 times (x minus x cubed divided by 3)

define hard clip using x
    description: Cuts the waveform straight across at ±1.
    give back max(-1.0, min(1.0, x))

define saturate using samples, drive_db=12.0, curve="tanh"
    description: Drives samples into a curve: "tanh", "soft" or "hard". The output is scaled back so a quiet signal keeps about its level.
    set drive to 10 ** (drive_db divided by 20)
    create list out
    for each x in samples
        if curve is "tanh"
            set y to math.tanh(x times drive)
        otherwise if curve is "soft"
            set y to the result of soft clip with x times drive
        otherwise
            set y to the result of hard clip with x times drive
        add y divided by drive to out
    give back out
== js shaper.js
define softClip using x
    description: The cubic soft clipper scaled to reach ±1. For Web Audio, fill a WaveShaperNode's curve with this.
    if x is at least 1
        give back 1
    if x is at most -1
        give back -1
    give back 1.5 * (x - x * x * x / 3)
define makeCurve using size, drive
    description: A Float32Array curve for a WaveShaperNode: tanh with drive, from input -1 to +1.
    constant curve is new Float32Array(size)
    repeat size times counting with i
        constant x is i * 2 / (size - 1) - 1
        set item i of curve to Math.tanh(x * drive)
    give back curve
== cpp shaper.cpp
include cmath
include algorithm

define soft_clip using float x giving back float
    note: The cubic soft clipper scaled to reach ±1.
    if x is at least 1.0f
        give back 1.0f
    if x is at most -1.0f
        give back -1.0f
    give back 1.5f * (x - x * x * x / 3.0f)

define saturate using float* samples, int count, float drive giving back nothing
    note: std::tanh is fine in a callback: it is maths, not memory or waiting. For heavy use, a lookup table or a cheaper curve saves time.
    repeat count times counting with i
        set samples[i] to std::tanh(samples[i] * drive) / drive`,

`part: denormals
title: Denormals
group: audio
types: daw, audio-plugin
about: Stop tiny numbers in fading filters and reverbs from slowing the CPU down.
summary: As a filter or reverb tail fades, its numbers get smaller than a float normally holds; the processor then stores them as "denormals", and on many x86 chips arithmetic on them is many times slower, which shows up as CPU spikes in silence. Plug-ins turn on flush-to-zero and denormals-are-zero (FTZ and DAZ) for the audio thread, at the start of each callback, or add a tiny offset to feedback paths. ARM chips used in recent Macs have their own flush-to-zero mode.
learn: How floating-point numbers are stored; why only very small numbers are affected.
source: Intel 64 and IA-32 Architectures Software Developer's Manual (MXCSR FTZ and DAZ bits) | https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html | FTZ is bit 15 (0x8000) and DAZ bit 6 (0x0040) of MXCSR
== cpp denormals.cpp
include cmath
above main: #if defined(__SSE__) || defined(_M_X64)
above main: #include <xmmintrin.h>
above main: #endif

define flush_denormals_to_zero giving back nothing
    note: Call at the start of the audio callback: these flags belong to the thread, and the host may reset them.
    c++: #if defined(__SSE__) || defined(_M_X64)
    c++: _mm_setcsr(_mm_getcsr() | 0x8040);
    c++: #endif

define kill_denormal using float x giving back float
    note: Where the flags can't be set: anything this small is silence anyway.
    if std::abs(x) is less than 1e-15f
        give back 0.0f
    give back x`,

`part: dc-blocker
title: DC blocker
group: audio
types: daw, audio-plugin, audio-tool, broadcast
about: Remove a constant offset (DC) that wastes headroom and thumps when audio starts or stops.
summary: Some sources and effects push the whole waveform up or down a little. That offset can't be heard, but it eats headroom and clicks at edits. A DC blocker is a tiny high-pass: y = x - previous x + R × previous y, with R a little under 1 (0.995 at 44.1 kHz) so only the very lowest frequencies are removed.
learn: The difference between two samples; the Biquad part for steeper high-passes.
source: DC Blocker (J. O. Smith, Introduction to Digital Filters) | https://ccrma.stanford.edu/~jos/filters/DC_Blocker.html | y(n) = x(n) - x(n-1) + R·y(n-1), R = 0.995 at 44.1 kHz
== python dc_blocker.py
define block dc using samples, r=0.995
    description: Removes a constant offset from a list of samples.
    set previous_x to 0.0
    set previous_y to 0.0
    create list out
    for each x in samples
        set y to x minus previous_x plus r times previous_y
        set previous_x to x
        set previous_y to y
        add y to out
    give back out
== cpp dc_blocker.cpp
define class DcBlocker
    field r: float = 0.995f
    field previous_x: float = 0.0f
    field previous_y: float = 0.0f
    define process using float x giving back float
        note: Two multiplies and two adds per sample: safe on the audio thread.
        set float y to x - previous_x + r * previous_y
        set self.previous_x to x
        set self.previous_y to y
        give back y`,

`part: wav-file
title: Reading and writing WAV files
group: audio
types: audio-tool, daw, broadcast, music-tool
about: Save samples as a WAV file any player opens, and read one back.
summary: A WAV file is a short header (RIFF, then a "fmt " chunk with the channel count, sample rate and bits per sample, then a "data" chunk) followed by the samples, little-endian. 16-bit PCM stores each sample as a whole number from -32768 to 32767, so samples from -1 to 1 are scaled and clamped first. Python's wave module writes the header for you; in a browser the header is built byte by byte.
learn: Bytes and little-endian numbers; why samples are clamped before they become whole numbers.
source: WAVE audio file format (Library of Congress) | https://www.loc.gov/preservation/digital/formats/fdd/fdd000001.shtml | the RIFF, fmt and data chunk layout
== python wav.py
import wave
import array

define save wav using samples, path, sample_rate=48000
    description: Writes samples (-1 to 1) to a 16-bit mono WAV file.
    set pcm to array.array("h", [int(max(-1.0, min(1.0, s)) * 32767) for s in samples])
    using wave.open(path, "wb") as f
        run f.setnchannels with 1
        run f.setsampwidth with 2
        run f.setframerate with sample_rate
        run f.writeframes with pcm.tobytes()

define load wav using path
    description: Reads a 16-bit mono WAV file; gives back its samples (-1 to 1) and its sample rate.
    using wave.open(path, "rb") as f
        set rate to f.getframerate()
        set pcm to array.array("h", f.readframes(f.getnframes()))
    give back [s / 32768 for s in pcm], rate
== js wav.js
define encodeWav using samples, sampleRate
    description: A Blob holding a 16-bit mono WAV file of samples (-1 to 1), ready to download or play.
    constant view is new DataView(new ArrayBuffer(44 + samples.length * 2))
    define writeText using at, word
        repeat length of word times counting with i
            run view.setUint8 with at + i, word.charCodeAt(i)
    run writeText with 0, "RIFF"
    run view.setUint32 with 4, 36 + samples.length * 2, true
    run writeText with 8, "WAVE"
    run writeText with 12, "fmt "
    run view.setUint32 with 16, 16, true
    run view.setUint16 with 20, 1, true
    run view.setUint16 with 22, 1, true
    run view.setUint32 with 24, sampleRate, true
    run view.setUint32 with 28, sampleRate * 2, true
    run view.setUint16 with 32, 2, true
    run view.setUint16 with 34, 16, true
    run writeText with 36, "data"
    run view.setUint32 with 40, samples.length * 2, true
    repeat length of samples times counting with i
        constant s is Math.max(-1, Math.min(1, item i of samples))
        run view.setInt16 with 44 + i * 2, Math.round(s * 32767), true
    give back new Blob([view], { type: "audio/wav" })`,

`part: ring-buffer
title: Lock-free ring buffer (one writer, one reader)
group: audio
types: daw, audio-plugin, broadcast, music-tool
about: Pass samples or messages between the audio thread and another thread without locks.
summary: The audio thread must never wait: a lock held by the interface or disk thread can make it miss its deadline and click. A single-producer, single-consumer ring buffer lets exactly one thread write and one thread read with two atomic counters and no lock. The writer only moves the write index, the reader only moves the read index; acquire and release ordering make the samples visible before the index that announces them. The storage is fixed when it's made, so nothing is allocated while audio runs.
learn: Threads; why locks and memory allocation are banned on the audio thread; std::atomic and memory ordering.
source: Ross Bencina, Real-time audio programming 101: time waits for nothing | http://www.rossbencina.com/code/real-time-audio-programming-101-time-waits-for-nothing | why the audio thread must not lock, allocate or wait, and lock-free queues as the answer
== cpp ring_buffer.cpp
include atomic
include array
include cstddef

define class RingBuffer
    note: One thread calls push, one other thread calls pop. One slot is always left empty, so "full" and "empty" look different.
    field slots: std::array<float, 4096> = {}
    field write_index: std::atomic<size_t> = 0
    field read_index: std::atomic<size_t> = 0
    define push using float value giving back bool
        note: The writer's side: gives back false (and drops the value) when the buffer is full, never waits.
        set size_t w to write_index.load(std::memory_order_relaxed)
        set size_t next to (w + 1) % slots.size()
        if next is read_index.load(std::memory_order_acquire)
            give back false
        set slots[w] to value
        run write_index.store with next, std::memory_order_release
        give back true
    define pop using float& value giving back bool
        note: The reader's side: gives back false when there is nothing to read, never waits.
        set size_t r to read_index.load(std::memory_order_relaxed)
        if r is write_index.load(std::memory_order_acquire)
            give back false
        set value to slots[r]
        run read_index.store with (r + 1) % slots.size(), std::memory_order_release
        give back true`,

`part: realtime-processor
title: A real-time audio processor
group: audio
types: audio-plugin, daw, broadcast
about: The shape every plug-in and audio engine shares: prepare once, then process blocks without waiting.
summary: Hosts (DAWs, JUCE, CLAP, VST3, AU) call a processor in two phases. prepare() runs before audio starts and may allocate memory and work out coefficients for the sample rate and the largest block size. process() runs on the audio thread for every block, a few milliseconds apart: it must not allocate, lock, open files, print or wait for anything, or the deadline is missed and the sound clicks. Parameters arrive from the interface thread through atomics and are smoothed per sample.
learn: The Parameter smoothing and Lock-free ring buffer parts; what a callback and a deadline are.
source: Ross Bencina, Real-time audio programming 101: time waits for nothing | http://www.rossbencina.com/code/real-time-audio-programming-101-time-waits-for-nothing | the rules for the audio thread
source: CLAP (CLever Audio Plug-in API) | https://github.com/free-audio/clap | the activate-then-process life cycle of a plug-in (idea only)
== cpp processor.cpp
include cmath
include atomic
include vector

define class GainProcessor
    note: set_gain_db is called from the interface thread; process from the audio thread. They share only an atomic.
    field target_gain: std::atomic<float> = 1.0f
    field gain: float = 1.0f
    field smoothing: float = 0.0f
    field scratch: std::vector<float>
    define prepare using double sample_rate, int max_block giving back nothing
        note: Allowed to make memory and do slow maths: audio isn't running yet.
        run scratch.assign with max_block, 0.0f
        set self.smoothing to std::exp(-1.0 / (0.02 * sample_rate))
    define set_gain_db using float db giving back nothing
        run target_gain.store with std::pow(10.0f, db / 20.0f), std::memory_order_relaxed
    define process using float* samples, int count giving back nothing
        note: The audio thread: arithmetic only. No new, no locks, no files, no printing.
        set float target to target_gain.load(std::memory_order_relaxed)
        repeat count times counting with i
            set self.gain to target + smoothing * (gain - target)
            set samples[i] to samples[i] * gain`,

`part: web-audio-graph
title: Web Audio player with a volume fader
group: audio
types: webpage, web-app, music-tool, browser-game, audio-tool
about: Play a sound file in a page through a gain node, with a fader in dB that doesn't click.
summary: The Web Audio API builds sound as a graph: a source (a file, an oscillator, the microphone) connects through nodes (gain, filters, compressors, analysers) to the speakers. Browsers only start audio after a click, so the context is made in the click handler. The fader is in dB and turned into a gain, and setTargetAtTime glides to it so moving the fader doesn't click.
learn: The Gain in decibels part; nodes and connections; why browsers wait for a click before playing sound.
source: Web Audio API (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API | AudioContext, GainNode, setTargetAtTime
== html index.html
add a file picker called track for sounds
add a button called play saying "Play"
add a slider called fader from -60 to 6
add a paragraph called readout "0 dB"
== js player.js
set context to nothing
set volume to nothing
when play is clicked
    if context is nothing
        set context to new AudioContext()
        set volume to context.createGain()
        run volume.gain.setValueAtTime with Math.pow(10, Number(fader.value) / 20), context.currentTime
        run volume.connect with context.destination
    set picked to file in track
    wait for picked.arrayBuffer() and store in bytes
    wait for context.decodeAudioData(bytes) and store in sound
    constant source is context.createBufferSource()
    set source.buffer to sound
    run source.connect with volume
    run source.start
when fader is changed
    constant db is Number(fader.value)
    set the text of readout to "{db} dB"
    if volume is not nothing
        run volume.gain.setTargetAtTime with Math.pow(10, db / 20), context.currentTime, 0.02`,

// ---------------------------------------------------------------- music

`part: midi-note-frequency
title: MIDI note to frequency
group: music
types: music-tool, daw, audio-plugin, arduino-gadget
about: Turn a MIDI note number into a pitch in hertz, and back, in equal temperament with A4 = 440 Hz.
summary: MIDI numbers notes from 0 to 127, with middle C as 60 and the A above it (A4) as 69. In equal temperament each semitone multiplies the frequency by the twelfth root of 2, so frequency = 440 × 2^((note - 69) / 12), and note = 69 + 12 × log2(frequency / 440). Fractions of a note are cents (a hundredth of a semitone), which is how tuners show how far off a note is.
learn: Powers of 2 and logarithms; semitones, octaves and cents.
source: MIDI 1.0 Detailed Specification | https://midi.org/midi-1-0-detailed-specification | note numbers 0 to 127, middle C = 60
source: ISO 16 (A4 = 440 Hz) | https://www.iso.org/standard/3601.html | the standard tuning frequency
== python notes.py
define note to frequency using note, a4=440.0
    description: The frequency in hertz of a MIDI note number (69 is A4).
    give back a4 times 2 ** ((note minus 69) divided by 12)

define frequency to note using frequency, a4=440.0
    description: The MIDI note number of a frequency, with a fraction for in-between pitches.
    give back 69 plus 12 times math.log2(frequency divided by a4)

define cents off using frequency
    description: How far a frequency is from the nearest note, in cents (-50 to +50).
    set note to the result of frequency to note with frequency
    give back (note minus round(note)) times 100
== js notes.js
define noteToFrequency using note, a4
    description: The frequency in hertz of a MIDI note number (69 is A4).
    give back a4 * Math.pow(2, (note - 69) / 12)
define frequencyToNote using frequency, a4
    description: The MIDI note number of a frequency, with a fraction for in-between pitches.
    give back 69 + 12 * Math.log2(frequency / a4)
== cpp notes.cpp
include cmath

define note_to_frequency using double note giving back double
    give back 440.0 * std::pow(2.0, (note - 69.0) / 12.0)

define frequency_to_note using double frequency giving back double
    give back 69.0 + 12.0 * std::log2(frequency / 440.0)
== arduino notes.ino
constant BUZZER is 8

define note_to_frequency using decimal note giving back decimal
    give back 440.0 * pow(2.0, (note - 69.0) / 12.0)

when the board starts
    make pin BUZZER an output

over and over
    count note from 60 to 72
        play a tone of note_to_frequency(note) on pin BUZZER for 200 milliseconds
        wait 250 milliseconds`,

`part: note-names
title: Note names
group: music
types: music-tool, learning-app
about: Turn a MIDI note number into a name like C4 or F#3, and a name back into a number.
summary: Twelve names repeat every octave: C, C#, D, D#, E, F, F#, G, G#, A, A#, B. The octave number goes up at each C; in the most common convention middle C (MIDI 60) is C4, though some software calls it C3, so say which one a program uses.
learn: Remainder (mod) and whole-number division; lists and finding an item's position.
== python note_names.py
set NAMES to ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

define note name using note
    description: A MIDI note number as a name with its octave: 60 is "C4".
    give back NAMES[note % 12] + str(note // 12 - 1)

define note number using name
    description: A name like "C4", "F#3" or "A-1" as a MIDI note number.
    set letters to name.rstrip("-0123456789")
    set octave to int(name[len(letters):])
    give back NAMES.index(letters) plus (octave plus 1) times 12
== js note_names.js
constant NAMES is ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
define noteName using note
    description: A MIDI note number as a name with its octave: 60 is "C4".
    give back NAMES[note % 12] + (Math.floor(note / 12) - 1)
define noteNumber using name
    description: A name like "C4" or "F#3" as a MIDI note number.
    constant found is name.match(/^([A-G]#?)(-?\\d+)$/)
    give back NAMES.indexOf(found[1]) + (Number(found[2]) + 1) * 12`,

`part: scales-chords
title: Scales and chords
group: music
types: music-tool, learning-app
about: Build the notes of a major or minor scale, or a chord, from a root note.
summary: A scale is a pattern of steps in semitones from its root: major is 2, 2, 1, 2, 2, 2, 1; natural minor is 2, 1, 2, 2, 1, 2, 2. A chord stacks notes from the root: a major triad is 0, 4 and 7 semitones above it, a minor triad 0, 3 and 7, a dominant seventh adds 10. Adding these to a MIDI note number gives the notes.
learn: Lists and adding to each item; the Note names part.
== python scales.py
set SCALES to {"major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10]}
set CHORDS to {"major": [0, 4, 7], "minor": [0, 3, 7], "seventh": [0, 4, 7, 10]}

define scale notes using root, kind="major"
    description: The MIDI notes of a scale from root, one octave.
    give back [root + step for step in SCALES[kind]]

define chord notes using root, kind="major"
    description: The MIDI notes of a chord on root.
    give back [root + step for step in CHORDS[kind]]
== js scales.js
constant SCALES is { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }
constant CHORDS is { major: [0, 4, 7], minor: [0, 3, 7], seventh: [0, 4, 7, 10] }
define scaleNotes using root, kind
    give back SCALES[kind].map((step) => root + step)
define chordNotes using root, kind
    give back CHORDS[kind].map((step) => root + step)`,

`part: tempo-grid
title: Tempo, bars and beats
group: music
types: daw, music-tool, audio-plugin
about: Turn a time in samples into bars, beats and ticks, and a tempo into samples per beat.
summary: At 120 beats per minute a beat lasts 0.5 s, which is 24,000 samples at 48 kHz: samples per beat = sample rate × 60 / BPM. A DAW's ruler counts bars, then beats in the bar (from the time signature), then ticks: fractions of a beat, often 960 per quarter note (PPQ), as MIDI files do. Counting from 1, as musicians do, the first beat of a song is 1.1.0.
learn: Whole-number division and remainders; the Metronome part.
source: Standard MIDI Files 1.0 | https://midi.org/standard-midi-files-specification | ticks per quarter note (division) as the unit of musical time
== python tempo.py
define samples per beat using bpm, sample_rate
    description: How many samples one beat lasts.
    give back sample_rate times 60 divided by bpm

define bars beats ticks using position, bpm, sample_rate, beats_per_bar=4, ppq=960
    description: A position in samples as (bar, beat, tick), counted from 1.1.0.
    set spb to the result of samples per beat with bpm, sample_rate
    set total_ticks to int(position times ppq divided by spb)
    set ticks_per_bar to ppq times beats_per_bar
    set bar to total_ticks // ticks_per_bar plus 1
    set beat to (total_ticks mod ticks_per_bar) // ppq plus 1
    set tick to total_ticks mod ppq
    give back bar, beat, tick
== js tempo.js
define samplesPerBeat using bpm, sampleRate
    give back sampleRate * 60 / bpm
define barsBeatsTicks using position, bpm, sampleRate, beatsPerBar, ppq
    description: A position in samples as [bar, beat, tick], counted from 1.1.0.
    constant total is Math.floor(position * ppq / samplesPerBeat(bpm, sampleRate))
    constant perBar is ppq * beatsPerBar
    give back [Math.floor(total / perBar) + 1, Math.floor((total % perBar) / ppq) + 1, total % ppq]
== cpp tempo.cpp
define samples_per_beat using double bpm, double sample_rate giving back double
    give back sample_rate * 60.0 / bpm

define beat_at using long long position, double bpm, double sample_rate giving back double
    note: Where a sample falls, in beats from the start (1.5 is halfway through the second beat).
    give back position / samples_per_beat(bpm, sample_rate)`,

`part: metronome
title: Metronome
group: music
types: music-tool, daw, arduino-gadget, learning-app
about: A click on every beat that stays in time, with an accent on the first beat of the bar.
summary: Timers in a browser (setTimeout, setInterval) drift by many milliseconds, which can be heard. The usual answer is two clocks: a timer wakes up often (every 25 ms) and schedules any clicks due in the next 100 ms on the audio clock, which is exact. On a board, millis() is compared with the time of the next beat instead of waiting with delay(), so the board can do other things between clicks.
learn: The Tempo part; the difference between "when to schedule" and "when it sounds".
source: Chris Wilson, Scheduling web audio with precision (A Tale of Two Clocks) | https://web.dev/articles/audio-scheduling | a 25 ms timer scheduling 100 ms ahead on the audio clock
== html index.html
add a number box called bpm with hint "120", from 30 to 300
add a button called start saying "Start"
== js metronome.js
set context to nothing
set nextBeat to 0
set beatNumber to 0
define click using time, accent
    constant tone is context.createOscillator()
    constant level is context.createGain()
    set tone.frequency.value to accent ? 1500 : 1000
    run level.gain.setValueAtTime with 0.5, time
    run level.gain.exponentialRampToValueAtTime with 0.001, time + 0.05
    run tone.connect with level
    run level.connect with context.destination
    run tone.start with time
    run tone.stop with time + 0.06
when start is clicked
    if context is not nothing
        give back
    set context to new AudioContext()
    set nextBeat to context.currentTime + 0.1
    every 0.025 seconds
        constant secondsPerBeat is 60 / Number(bpm.value || 120)
        while nextBeat is less than context.currentTime + 0.1
            run click with nextBeat, beatNumber % 4 === 0
            set nextBeat to nextBeat + secondsPerBeat
            increase beatNumber
== arduino metronome.ino
constant BUZZER is 8
constant BPM is 120
set unsigned long last_beat to 0
set beat to 0

when the board starts
    make pin BUZZER an output

over and over
    note: Adding the beat length to the last beat's time (not to "now") keeps the clicks from drifting.
    if millis() - last_beat is at least 60000 / BPM
        set last_beat to last_beat + 60000 / BPM
        if beat % 4 is 0
            play a tone of 1500 on pin BUZZER for 30 milliseconds
        otherwise
            play a tone of 1000 on pin BUZZER for 30 milliseconds
        increase beat`,

`part: adsr
title: ADSR envelope
group: music
types: music-tool, audio-plugin, browser-game
about: Shape a note's level over time: attack, decay, sustain and release.
summary: An envelope makes a note start and stop like an instrument rather than switching on and off. Attack rises from 0 to 1, decay falls to the sustain level, which holds while the key is down; release falls to 0 after the key is let go. This one moves in straight lines per sample; many synths use exponential curves, which sound more natural for decay and release.
learn: A small state machine (which stage it is in); per-sample steps from times in seconds.
== python adsr.py
define class Envelope
    description: A linear ADSR envelope. Times in seconds, sustain from 0 to 1.
    define __init__ using self, sample_rate, attack=0.01, decay=0.1, sustain=0.7, release=0.3
        set self.rate to sample_rate
        set self.attack to attack
        set self.decay to decay
        set self.sustain to sustain
        set self.release to release
        set self.stage to "idle"
        set self.level to 0.0

    define note on using self
        set self.stage to "attack"

    define note off using self
        set self.stage to "release"

    define next level using self
        description: The envelope's level for the next sample.
        if self.stage is "attack"
            increase self.level by 1 divided by max(self.attack times self.rate, 1)
            if self.level is at least 1
                set self.level to 1.0
                set self.stage to "decay"
        otherwise if self.stage is "decay"
            decrease self.level by (1 minus self.sustain) divided by max(self.decay times self.rate, 1)
            if self.level is at most self.sustain
                set self.level to self.sustain
                set self.stage to "sustain"
        otherwise if self.stage is "release"
            decrease self.level by self.sustain divided by max(self.release times self.rate, 1)
            if self.level is at most 0
                set self.level to 0.0
                set self.stage to "idle"
        give back self.level
== js adsr.js
define playNote using context, frequency, length, attack, decay, sustain, release
    description: Plays a note with an ADSR envelope, using Web Audio's scheduled ramps. Times in seconds; sustain from 0 to 1.
    constant now is context.currentTime
    constant tone is context.createOscillator()
    constant level is context.createGain()
    set tone.frequency.value to frequency
    run level.gain.setValueAtTime with 0, now
    run level.gain.linearRampToValueAtTime with 1, now + attack
    run level.gain.linearRampToValueAtTime with sustain, now + attack + decay
    run level.gain.setValueAtTime with sustain, now + length
    run level.gain.linearRampToValueAtTime with 0, now + length + release
    run tone.connect with level
    run level.connect with context.destination
    run tone.start with now
    run tone.stop with now + length + release
== cpp adsr.cpp
include algorithm

define class Envelope
    note: Steps are worked out when a note starts, so next() is a few comparisons and adds: safe per sample on the audio thread.
    field stage: int = 0
    field level: float = 0.0f
    field attack_step: float = 0.001f
    field decay_step: float = 0.0001f
    field release_step: float = 0.0001f
    field sustain: float = 0.7f
    define note_on using float sample_rate, float attack, float decay, float release giving back nothing
        set self.attack_step to 1.0f / std::max(attack * sample_rate, 1.0f)
        set self.decay_step to (1.0f - sustain) / std::max(decay * sample_rate, 1.0f)
        set self.release_step to sustain / std::max(release * sample_rate, 1.0f)
        set self.stage to 1
    define note_off giving back nothing
        set self.stage to 4
    define next giving back float
        note: Stages: 0 idle, 1 attack, 2 decay, 3 sustain, 4 release.
        if stage is 1
            set self.level to level + attack_step
            if level is at least 1.0f
                set self.level to 1.0f
                set self.stage to 2
        otherwise if stage is 2
            set self.level to level - decay_step
            if level is at most sustain
                set self.level to sustain
                set self.stage to 3
        otherwise if stage is 4
            set self.level to level - release_step
            if level is at most 0.0f
                set self.level to 0.0f
                set self.stage to 0
        give back level`,

`part: oscillator
title: Oscillators
group: music
types: music-tool, audio-plugin, browser-game, arduino-gadget
about: Sine, saw, square and triangle waves from a phase that goes round once per cycle.
summary: An oscillator keeps a phase from 0 to 1 and moves it on by frequency / sample rate every sample, wrapping round at 1. Each wave shape is a function of that phase. Saw, square and triangle made this way (naively) have sharp corners, which alias into odd tones at high pitches; synths smooth the corners with methods such as PolyBLEP or use wavetables.
learn: The remainder of dividing by 1; sine; what aliasing sounds like.
source: Välimäki and Huovilainen, Antialiasing Oscillators in Subtractive Synthesis (IEEE Signal Processing Magazine, 2007) | https://doi.org/10.1109/MSP.2007.323276 | why naive saw and square waves alias, and how it is reduced
== python oscillator.py
define oscillator using shape, frequency, seconds, sample_rate=48000
    description: A list of samples of a "sine", "saw", "square" or "triangle" wave, from -1 to 1 (naive, so high notes alias).
    set phase to 0.0
    set step to frequency divided by sample_rate
    create list out
    repeat int(seconds times sample_rate) times
        if shape is "sine"
            add math.sin(2 times math.pi times phase) to out
        otherwise if shape is "saw"
            add 2 times phase minus 1 to out
        otherwise if shape is "square"
            add 1.0 if phase is less than 0.5 otherwise -1.0 to out
        otherwise
            add 1 minus 4 times abs(phase minus 0.5) to out
        set phase to (phase plus step) mod 1.0
    give back out
== js oscillator.js
define waveAt using shape, phase
    description: One sample of a wave at a phase from 0 to 1. Web Audio's OscillatorNode makes band-limited versions of these for playback.
    if shape is "sine"
        give back Math.sin(2 * Math.PI * phase)
    if shape is "saw"
        give back 2 * phase - 1
    if shape is "square"
        give back phase < 0.5 ? 1 : -1
    give back 1 - 4 * Math.abs(phase - 0.5)
== cpp oscillator.cpp
include cmath
include numbers

define class Oscillator
    note: A phase accumulator: one add and one wrap per sample, safe on the audio thread.
    field phase: double = 0.0
    field step: double = 0.0
    define set_frequency using double frequency, double sample_rate giving back nothing
        set self.step to frequency / sample_rate
    define next_sine giving back float
        set float out to std::sin(2.0 * std::numbers::pi * phase)
        set self.phase to phase + step
        if phase is at least 1.0
            set self.phase to phase - 1.0
        give back out`,

`part: midi-messages
title: MIDI messages
group: music
types: music-tool, daw, arduino-gadget
about: Build and read the three bytes of a MIDI note on, note off or control change.
summary: A MIDI 1.0 message starts with a status byte: the top four bits say what it is (0x90 note on, 0x80 note off, 0xB0 control change) and the bottom four the channel (0 to 15, shown to people as 1 to 16). Two data bytes follow, each 0 to 127: for notes, the note number and the velocity. A note on with velocity 0 means note off. A DIN MIDI cable runs at 31,250 bits per second.
learn: Bytes and hexadecimal; the bitwise and (&) and or (|).
source: MIDI 1.0 Detailed Specification | https://midi.org/midi-1-0-detailed-specification | status bytes, channels, data bytes and the 31,250 baud rate
== python midi.py
define note on using channel, note, velocity
    description: The three bytes of a note on, as a list (bytes(...) of it is what is sent). channel is 0 to 15 (people call it 1 to 16).
    give back [0x90 | channel, note & 0x7F, velocity & 0x7F]

define note off using channel, note
    give back [0x80 | channel, note & 0x7F, 0]

define describe using message
    description: What a three-byte message is, in words.
    set kind to item 0 of message & 0xF0
    set channel to (item 0 of message & 0x0F) plus 1
    if kind is 0x90 and item 2 of message is more than 0
        give back "note on {item 1 of message}, velocity {item 2 of message}, channel {channel}"
    if kind is 0x80 or kind is 0x90
        give back "note off {item 1 of message}, channel {channel}"
    if kind is 0xB0
        give back "control {item 1 of message} = {item 2 of message}, channel {channel}"
    give back "other"
== arduino midi_out.ino
constant BUTTON is 2
set was_pressed to false

define send_midi using whole number status, whole number data1, whole number data2
    run Serial.write with status
    run Serial.write with data1
    run Serial.write with data2

when the board starts
    make pin BUTTON an input with pull-up
    note: 31250 is MIDI's own speed: for a DIN socket on the TX pin. Over USB, use a MIDI-to-serial bridge on the computer.
    start the serial monitor at 31250

over and over
    set pressed to digitalRead(BUTTON) == LOW
    if pressed and not was_pressed
        run send_midi with 0x90, 60, 100
    if was_pressed and not pressed
        run send_midi with 0x80, 60, 0
    set was_pressed to pressed
    wait 5 milliseconds`,

);
