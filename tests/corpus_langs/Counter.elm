module Counter exposing (Model, Msg(..), init, main, update, view)

import Browser
import Html exposing (Html, button, div, p, text)
import Html.Events exposing (onClick)


-- MODEL


type alias Model =
    { count : Int
    , step : Int
    }


init : Model
init =
    { count = 0, step = 1 }



-- UPDATE


type Msg
    = Increment
    | Decrement
    | Reset
    | SetStep Int


update : Msg -> Model -> Model
update msg model =
    case msg of
        Increment ->
            { model | count = model.count + model.step }

        Decrement ->
            { model | count = max 0 (model.count - model.step) }

        Reset ->
            init

        SetStep n ->
            { model | step = n }



-- VIEW


view : Model -> Html Msg
view model =
    div []
        [ button [ onClick Decrement ] [ text "-" ]
        , p [] [ text (String.fromInt model.count) ]
        , button [ onClick Increment ] [ text "+" ]
        , button [ onClick Reset ] [ text "Reset" ]
        ]


main : Program () Model Msg
main =
    Browser.sandbox { init = init, update = update, view = view }
