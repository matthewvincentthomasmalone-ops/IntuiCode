// A star rating picker for product reviews.
type rating = {
  stars: int,
  comment: option<string>,
}

type action =
  | Pick(int)
  | Comment(string)
  | Clear

let maxStars = 5

let describe = stars =>
  switch stars {
  | 0 => "Not rated"
  | 1 | 2 => "Poor"
  | 3 => "Fine"
  | _ => "Good"
  }

let reducer = (state, action) =>
  switch action {
  | Pick(n) => {...state, stars: n}
  | Comment(text) => {...state, comment: Some(text)}
  | Clear => {stars: 0, comment: None}
  }

module Star = {
  @react.component
  let make = (~filled: bool, ~onClick) =>
    <button className={filled ? "star on" : "star"} onClick> {React.string("*")} </button>
}

@react.component
let make = (~onSave: rating => unit) => {
  let (state, dispatch) = React.useReducer(reducer, {stars: 0, comment: None})
  let stars = Belt.Array.range(1, maxStars)->Belt.Array.map(n =>
    <Star key={Belt.Int.toString(n)} filled={n <= state.stars} onClick={_ => dispatch(Pick(n))} />
  )
  <div className="rating">
    {React.array(stars)}
    <p> {React.string(describe(state.stars))} </p>
    <button onClick={_ => onSave(state)}> {React.string("Save")} </button>
    <button onClick={_ => dispatch(Clear)}> {React.string("Clear")} </button>
  </div>
}

let logRating = r => Js.log2("Rated", r.stars)
