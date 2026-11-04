------------------------------ MODULE Crossing ------------------------------
(* A pedestrian crossing: the cars' light and the walkers' light must never  *)
(* both be green.                                                             *)
EXTENDS Naturals

CONSTANT MaxWait

VARIABLES cars, walk, waiting

vars == <<cars, walk, waiting>>

Lights == {"red", "amber", "green"}

TypeOK ==
    /\ cars \in Lights
    /\ walk \in {"stop", "go"}
    /\ waiting \in 0..MaxWait

Init ==
    /\ cars = "green"
    /\ walk = "stop"
    /\ waiting = 0

Press ==
    /\ waiting < MaxWait
    /\ waiting' = waiting + 1
    /\ UNCHANGED <<cars, walk>>

CarsAmber ==
    /\ cars = "green"
    /\ waiting > 0
    /\ cars' = "amber"
    /\ UNCHANGED <<walk, waiting>>

CarsStop ==
    /\ cars = "amber"
    /\ cars' = "red"
    /\ walk' = "go"
    /\ waiting' = 0

WalkEnds ==
    /\ walk = "go"
    /\ walk' = "stop"
    /\ cars' = "green"
    /\ UNCHANGED waiting

Next == Press \/ CarsAmber \/ CarsStop \/ WalkEnds

Spec == Init /\ [][Next]_vars

Safe == ~(cars = "green" /\ walk = "go")

THEOREM Spec => []Safe
=============================================================================
