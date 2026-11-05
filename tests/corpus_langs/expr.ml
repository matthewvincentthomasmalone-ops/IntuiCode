(* A tiny calculator: parse, simplify and evaluate arithmetic expressions. *)
open Printf

type expr =
  | Num of float
  | Var of string
  | Add of expr * expr
  | Mul of expr * expr
  | Neg of expr

exception Unbound of string

let rec to_string e =
  match e with
  | Num n -> sprintf "%g" n
  | Var v -> v
  | Add (a, b) -> sprintf "(%s + %s)" (to_string a) (to_string b)
  | Mul (a, b) -> sprintf "%s * %s" (to_string a) (to_string b)
  | Neg a -> "-" ^ to_string a

let rec simplify e =
  match e with
  | Add (Num 0., x) | Add (x, Num 0.) -> simplify x
  | Mul (Num 1., x) | Mul (x, Num 1.) -> simplify x
  | Mul (Num 0., _) | Mul (_, Num 0.) -> Num 0.
  | Add (a, b) -> Add (simplify a, simplify b)
  | Mul (a, b) -> Mul (simplify a, simplify b)
  | Neg (Neg x) -> simplify x
  | other -> other

let rec eval env e =
  match e with
  | Num n -> n
  | Var v -> (try List.assoc v env with Not_found -> raise (Unbound v))
  | Add (a, b) -> eval env a +. eval env b
  | Mul (a, b) -> eval env a *. eval env b
  | Neg a -> -.(eval env a)

module Env = struct
  type t = (string * float) list
  let empty : t = []
  let bind name value (env : t) : t = (name, value) :: env
end

let () =
  let e = Add (Mul (Num 1., Var "x"), Num 0.) in
  let env = Env.bind "x" 4. Env.empty in
  printf "%s simplifies to %s\n" (to_string e) (to_string (simplify e));
  printf "with x = 4 it is %g\n" (eval env e)
