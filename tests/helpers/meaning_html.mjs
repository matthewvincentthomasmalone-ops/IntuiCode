// What the website writer's Structure (HTML) and Styling (CSS) words mean, checked in a real browser
// (tests/helpers/meaning_browser.mjs): the page is built, Chrome loads it, and each check looks at what Chrome made of
// it: the elements, and the style it works out for them (getComputedStyle).
//   page     Structure sentences          style    Styling sentences          mechanics   Mechanics sentences
//   then     what happens after the page loads (await page.hover("save"), page.resize(500), page.click(…))
//   holds    checks, as JavaScript: document, and page.q(selector), page.css(selector, property[, "::before"]),
//            page.el(id), page.text(id)
// Index entries with no example are in NOT_RUN_HTML, with why.

const css = (sel, prop, want) => `page.css(${JSON.stringify(sel)}, ${JSON.stringify(prop)}) === ${JSON.stringify(want)}`;

export const HTML_STRUCTURE = [
  { page: 'page title is "Shop"', holds: 'document.title === "Shop"' },
  { page: 'add a big heading "Hi"', holds: 'page.q("h1").textContent === "Hi"' },
  { page: 'add a heading "Hi"', holds: ['page.q("h2").textContent === "Hi"', '!document.querySelector("h1")'] },
  { page: 'add a paragraph called note saying "Hello"', holds: 'page.el("note").tagName === "P" && page.text("note") === "Hello"' },
  { page: 'add a paragraph "Hello"', holds: 'page.q("p").textContent === "Hello"' },
  // a button that does nothing by itself (not a form's submit button)
  { page: 'add a button called save saying "Save"', holds: 'page.el("save").tagName === "BUTTON" && page.text("save") === "Save" && page.el("save").type === "button"' },
  { page: 'add a text box called name with hint "Your name"', holds: 'page.el("name").tagName === "INPUT" && page.el("name").placeholder === "Your name" && page.el("name").type === "text"' },
  { page: 'add a drop-down called size with "S", "M", "L"', holds: 'page.el("size").tagName === "SELECT" && [...page.el("size").options].map(o => o.text).join() === "S,M,L" && page.el("size").value === "S"' },
  // a number box takes what its words allow, and the browser says when a value is outside it
  { page: 'add a number box called qty allowing decimals, from 0 to 100', then: 'page.el("qty").value = "2.5"; window.half = page.el("qty").checkValidity(); page.el("qty").value = "150";',
    holds: 'page.el("qty").type === "number" && half === true && page.el("qty").validity.rangeOverflow && page.el("qty").min === "0" && page.el("qty").max === "100"' },
  { page: 'add a number box called qty from 0 to 10', then: 'page.el("qty").value = "2.5";', holds: 'page.el("qty").validity.stepMismatch' },   // (whole numbers only, without "allowing decimals")
  { page: 'add a checkbox called agree saying "I agree"', then: 'window.before = page.el("agree").checked; page.el("agree").labels[0].click();',
    holds: 'page.el("agree").type === "checkbox" && before === false && page.el("agree").checked === true && page.el("agree").labels[0].textContent.includes("I agree")' },
  { page: 'add a slider called volume from 0 to 11', holds: 'page.el("volume").type === "range" && page.el("volume").min === "0" && page.el("volume").max === "11"' },
  { page: 'add a file picker called pic for pictures', holds: 'page.el("pic").type === "file" && page.el("pic").accept === "image/*"' },
  // a hidden value is sent with its form, and never shown
  { page: 'add a form called signup\n    add a hidden value "home" sent as "source"\n    add a text box called who, sent as "who"',
    holds: 'new FormData(page.el("signup")).get("source") === "home" && page.q("input[type=hidden]").getBoundingClientRect().height === 0 && page.q("input[type=hidden]").checkVisibility() === false' },
  { page: 'add a picture of "cat.png" described as "A cat on a mat"', holds: 'page.q("img").alt === "A cat on a mat" && page.q("img").getAttribute("src") === "cat.png" && page.q("img").complete && page.q("img").naturalWidth === 1' },
  { page: 'add a drawing area called game 480 by 270', holds: 'page.el("game").tagName === "CANVAS" && page.el("game").width === 480 && page.el("game").height === 270' },
  { page: 'add a link to "https://example.com/" saying "Go"', holds: 'page.q("a").href === "https://example.com/" && page.q("a").textContent === "Go"' },
  { page: 'add a section called intro', holds: 'page.el("intro").tagName === "SECTION"' },
  { page: 'add a list called items', holds: 'page.el("items").tagName === "UL"' },
  { page: 'add a button called save saying "Save" in group big', holds: 'page.el("save").classList.contains("big")' },
  { page: 'add a box called panel', holds: 'page.el("panel").tagName === "DIV"' },
  { page: 'add a figure', holds: '!!document.querySelector("figure")' },
  { page: 'add a collapsible section', holds: '!!document.querySelector("details")' },
  { page: 'add a my-widget element', holds: '!!document.querySelector("my-widget")' },
  { page: 'add a box called panel\n    "Hello there"', holds: 'page.text("panel").trim() === "Hello there"' },
  { page: 'add bold text "Big"', holds: 'page.q("b").textContent === "Big" && page.css("b", "fontWeight") === "700"' },
  { page: 'add a chart called sales 600 by 300', holds: 'page.el("sales").tagName === "CANVAS" && page.el("sales").width === 600 && page.el("sales").height === 300' },
  { page: 'add a picture of "dot.png" described as "", hidden from screen readers', holds: 'page.q("img").getAttribute("aria-hidden") === "true"' },
  { page: 'add a button called save saying "Save", with tooltip "Save it"', holds: 'page.el("save").title === "Save it"' },
  { page: 'add a button called c saying "C", storing chord "C major"', holds: 'page.el("c").dataset.chord === "C major"' },
  { page: 'add a button called save saying "Save", disabled', then: 'window.clicks = 0; page.el("save").addEventListener("click", () => clicks++); await page.click("save");', holds: 'page.el("save").disabled && clicks === 0' },
  { page: 'add a button called save saying "Save", running "saveAll()" when clicked', mechanics: 'set saved to 0\njs: function saveAll() { saved = saved + 1; }', then: 'await page.click("save");', holds: 'saved === 1' },
  { page: 'add a text box called email with hint "you@example.com", with type "email"', then: 'page.el("email").value = "nope";', holds: 'page.el("email").type === "email" && page.el("email").validity.typeMismatch' },
  { page: 'add a paragraph called p\n    "Hi"\n    add bold text "there"', holds: 'page.text("p").replace(/\\s+/g, " ").trim() === "Hi there"' },
  { page: 'add a paragraph called p\n    "Hi"\n    add bold text "there", with no space before it', holds: 'page.text("p").trim() === "Hithere"' },
  // drawings (SVG): checked by where the browser draws them (getBBox)
  { page: 'add a drawing sized 200 by 100, drawn on a 100 by 50 grid\n    add a rectangle at 10, 10 sized 20 by 10', holds: 'page.q("svg").getBoundingClientRect().width === 200 && page.q("svg").getAttribute("viewBox") === "0 0 100 50" && page.q("rect").getBoundingClientRect().width === 40' },
  { page: 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n    add a circle at 50, 50 with radius 40, filled with gold', holds: 'JSON.stringify(Object.values(page.q("circle").getBBox().toJSON ? page.q("circle").getBBox().toJSON() : (({x, y, width, height}) => ({x, y, width, height}))(page.q("circle").getBBox()))) === "[10,10,80,80]" && page.css("circle", "fill") === "rgb(255, 215, 0)"' },
  { page: 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n    add a rectangle at 10, 10 sized 80 by 40, with rounded corners 6', holds: 'page.q("rect").getBBox().width === 80 && page.q("rect").getBBox().height === 40 && page.q("rect").getBBox().x === 10 && page.q("rect").rx.baseVal.value === 6' },
  { page: 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n    add a line from 0, 0 to 100, 50, outlined in navy, outline 2 wide', holds: 'page.q("line").getBBox().width === 100 && page.q("line").getBBox().height === 50 && page.css("line", "stroke") === "rgb(0, 0, 128)" && page.css("line", "strokeWidth") === "2px"' },
  { page: 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n    add a path following "M 0 0 L 100 50", not filled, outlined in navy', holds: 'page.q("path").getTotalLength() > 111 && page.q("path").getTotalLength() < 112 && page.css("path", "fill") === "none" && page.css("path", "stroke") === "rgb(0, 0, 128)"' },
  { page: 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n    add text "Hi" at 10, 20', holds: 'page.q("text").textContent === "Hi" && page.q("text").x.baseVal[0].value === 10 && page.q("text").y.baseVal[0].value === 20' },
  { page: 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n    add a gradient called sky from #87ceeb to #ffffff\n    add a rectangle at 0, 0 sized 100 by 100, filled with the gradient sky', holds: '[...document.querySelectorAll("#sky stop")].map(s => getComputedStyle(s).stopColor).join() === "rgb(135, 206, 235),rgb(255, 255, 255)" && page.css("rect", "fill").includes("#sky")' },
  { page: 'add a drawing sized 100 by 100, drawn on a 100 by 100 grid\n    add a set of shapes, outlined in navy\n        add a circle at 50, 50 with radius 10', holds: 'page.q("g").contains(page.q("circle")) && page.css("circle", "stroke") === "rgb(0, 0, 128)"' },
  // the words for elements
  { page: 'add a button called "helpToggle" saying "?"', holds: '!!document.getElementById("helpToggle")' },
  { page: 'add a box called card in group card', holds: 'page.el("card").className === "card"' },
  { page: 'add a navigation bar called top', holds: 'page.el("top").tagName === "NAV"' },
  { page: 'add a main area called content', holds: 'page.el("content").tagName === "MAIN"' },
  { page: 'add a side panel called extra', holds: 'page.el("extra").tagName === "ASIDE"' },
  { page: 'add a block called b', holds: 'page.el("b").tagName === "DIV"' },
  { page: 'add a big text box called notes', holds: 'page.el("notes").tagName === "TEXTAREA"' },
];

export const HTML_STYLING = [
  { page: 'add a heading called title saying "Hi"', style: 'set title colour to red', holds: css('#title', 'color', 'rgb(255, 0, 0)') },
  { page: 'add a box called panel', style: 'give panel a red border', holds: [css('#panel', 'borderTopWidth', '1px'), css('#panel', 'borderTopStyle', 'solid'), css('#panel', 'borderTopColor', 'rgb(255, 0, 0)')] },
  { page: 'add a paragraph called p saying "x"', style: 'make p bold', holds: css('#p', 'fontWeight', '700') },
  { page: 'add a box called panel', style: 'style panel: background navy, text colour white', holds: [css('#panel', 'backgroundColor', 'rgb(0, 0, 128)'), css('#panel', 'color', 'rgb(255, 255, 255)')] },
  { page: 'add a box called a\nadd a box called b', style: 'add group card: rounded corners 8\nadd a to group card', holds: [css('#a', 'borderTopLeftRadius', '8px'), css('#b', 'borderTopLeftRadius', '0px')] },
  { page: 'add a heading called title saying "Hi"', style: 'add a colour called main #4f7cff\nset title colour to the colour main', holds: [css('#title', 'color', 'rgb(79, 124, 255)'), 'getComputedStyle(document.documentElement).getPropertyValue("--main").trim() === "#4f7cff"'] },
  { page: 'add a box called a in group card', style: 'create group card: rounded corners 8, shadow', holds: [css('#a', 'borderTopLeftRadius', '8px'), 'page.css("#a", "boxShadow") !== "none"'] },
  { page: 'add a box called panel', style: 'style panel: border 2 dashed navy', holds: [css('#panel', 'borderTopWidth', '2px'), css('#panel', 'borderTopStyle', 'dashed'), css('#panel', 'borderTopColor', 'rgb(0, 0, 128)')] },
  { page: 'add a box called panel', style: 'style panel: text colour navy\nadd a border to panel', holds: [css('#panel', 'borderTopWidth', '1px'), css('#panel', 'borderTopColor', 'rgb(0, 0, 128)')] },
  { page: 'add a heading called title saying "Hi"', style: 'add group big: text size 40\ntitle belongs to group big', holds: css('#title', 'fontSize', '40px') },
  { page: 'add a button called save saying "Save"', style: 'when save is hovered: background navy', then: 'window.before = page.css("#save", "backgroundColor"); await page.hover("save");', holds: ['before !== "rgb(0, 0, 128)"', css('#save', 'backgroundColor', 'rgb(0, 0, 128)')] },
  { page: 'add a paragraph called side saying "x"', style: 'on screens narrower than 600:\n    style side: hidden', then: 'window.wide = page.css("#side", "display"); await page.resize(500);', holds: ['wide === "block"', css('#side', 'display', 'none')] },
  { page: 'add a heading called title saying "Hi"', style: 'shared colour main is #4f7cff\nset title colour to the colour main', holds: css('#title', 'color', 'rgb(79, 124, 255)') },
  { page: 'add a paragraph called note saying "x"', style: 'before note: content: "★ ", text colour gold', holds: ['page.css("#note", "content", "::before") === \'"★ "\'', 'getComputedStyle(page.el("note"), "::before").color === "rgb(255, 215, 0)"'] },
  // the words for styles
  { page: 'add a box called panel', style: 'style panel: background #000 40% see-through', holds: css('#panel', 'backgroundColor', 'rgba(0, 0, 0, 0.6)') },
  { page: 'add a box called panel', style: 'style panel: 50% see-through', holds: css('#panel', 'opacity', '0.5') },
  { page: 'add a box called panel', style: 'style panel: text size 20', holds: css('#panel', 'fontSize', '20px') },
  { page: 'add a box called panel', style: 'style panel: space inside 12', holds: [css('#panel', 'paddingTop', '12px'), css('#panel', 'paddingLeft', '12px')] },
  { page: 'add a box called panel', style: 'style panel: space around 8', holds: [css('#panel', 'marginTop', '8px'), css('#panel', 'marginRight', '8px')] },
  { page: 'add a box called panel', style: 'style panel: rounded corners 8', holds: css('#panel', 'borderBottomRightRadius', '8px') },
  { page: 'add a box called panel', style: 'style panel: in a row', holds: css('#panel', 'display', 'flex') },
  { page: 'add a box called panel', style: 'style panel: in a grid of 3 columns', holds: [css('#panel', 'display', 'grid'), 'page.css("#panel", "gridTemplateColumns").split(" ").length === 3'] },
  { page: 'add a box called panel', style: 'style panel: hand cursor', holds: css('#panel', 'cursor', 'pointer') },
  { page: 'add a box called panel', style: 'style panel: width 50 percent, centred', holds: ['page.el("panel").getBoundingClientRect().width === document.body.clientWidth / 2', 'page.css("#panel", "marginLeft") === page.css("#panel", "marginRight") && parseFloat(page.css("#panel", "marginLeft")) > 0'] },
  { page: 'add a paragraph called panel saying "x"', style: 'style panel: hidden', holds: [css('#panel', 'display', 'none'), 'page.el("panel").getBoundingClientRect().height === 0'] },
  { page: 'add a paragraph called p saying "x"', style: 'style p: underlined', holds: css('#p', 'textDecorationLine', 'underline') },
  { page: 'add a paragraph called p saying "x"', style: 'style p: text size 16, line height 1.5', holds: css('#p', 'lineHeight', '24px') },
  { page: 'add a paragraph called p saying "x"', style: 'style p: text weight 600', holds: css('#p', 'fontWeight', '600') },
  { page: 'add a box called panel', style: 'style panel: background gradient from #fff to #000', holds: css('#panel', 'backgroundImage', 'linear-gradient(rgb(255, 255, 255), rgb(0, 0, 0))') },
  { page: 'add a box called panel', style: 'style panel: background royal blue', holds: css('#panel', 'backgroundColor', 'rgb(65, 105, 225)') },
  { page: 'add a box called panel', style: 'style panel: text size 2 em', holds: css('#panel', 'fontSize', '32px') },
  { page: 'add a box called panel', style: 'style panel: background rgb 255 0 0', holds: css('#panel', 'backgroundColor', 'rgb(255, 0, 0)') },
];

export const NOT_RUN_HTML = {};
