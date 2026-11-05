/* IntuCode Library — networking and security parts. */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

`part: fetch-retry
title: Fetching with a time-out and retries
group: networking
types: web-app, api-service, chat-bot, browser-extension, automation-script
about: Ask a server for JSON without hanging forever, and try again (waiting longer each time) when the network or server fails.
summary: Networks drop and servers have bad moments, so a request needs a time-out and a few retries. The wait between tries doubles each time (exponential backoff) and is randomised (jitter) so many clients don't all retry at the same moment. Only failures that might pass are retried: a dropped connection, a time-out, a 5xx error or 429 (too many requests); a 404 or 400 won't get better by asking again.
learn: Waiting for things that finish later (await); HTTP status codes.
source: AWS Architecture Blog, Exponential Backoff And Jitter | https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ | doubling waits with random jitter
== js fetch.js
define fetchJson using url, tries
    description: Fetches JSON with a 10-second time-out, retrying network failures, 5xx and 429 with growing, random waits.
    set lastProblem to "nothing was tried"
    repeat tries times counting with attempt
        if attempt is more than 0
            constant pause is 500 * Math.pow(2, attempt - 1) * (0.5 + Math.random())
            wait for new Promise((done) => setTimeout(done, pause))
        try
            js: const signal = AbortSignal.timeout(10000);
            wait for fetch(url, { signal: signal }) and store in reply
            if reply.ok
                wait for reply.json() and store in data
                give back data
            set lastProblem to "the server answered " + reply.status
            if reply.status is less than 500 and reply.status is not 429
                stop the loop
        if it fails as problem
            set lastProblem to problem.message
    fail with "Couldn't fetch " + url + ": " + lastProblem
== python fetch.py
import json
import random
import time
python: import urllib.error
python: import urllib.request

define fetch json using url, tries=4, timeout=10
    description: Fetches JSON with a time-out, retrying dropped connections, 5xx and 429 with growing, random waits.
    set problem to "nothing was tried"
    count attempt from 0 to tries minus 1
        if attempt is more than 0
            run time.sleep with 0.5 * 2 ** (attempt - 1) * (0.5 + random.random())
        try
            using urllib.request.urlopen(url, timeout=timeout) as reply
                give back json.load(reply)
        if it fails with urllib.error.HTTPError as error
            set problem to "the server answered {error.code}"
            if error.code is less than 500 and error.code is not 429
                stop the loop
        if it fails with urllib.error.URLError as error
            set problem to str(error.reason)
    fail with ConnectionError: "Couldn't fetch {url}: {problem}"`,

`part: json-route
title: A web route that answers JSON
group: networking
types: web-app, api-service
about: A server address that lists and adds records, checking what it is sent and answering with the right status code.
summary: A route is a path and a method: GET /api/notes lists the notes, POST /api/notes adds one. The server never trusts what arrives: it checks the text is there and not too long, and answers 400 with a reason if not, or 201 (created) with the new record. The same route in Flask (Python) and Express (TypeScript) shows how alike they are.
learn: HTTP methods and status codes; JSON; the Checking a form part (why the server checks again).
source: Flask quickstart | https://flask.palletsprojects.com/en/stable/quickstart/ | routes, request.get_json and jsonify
== python app.py
python: from flask import Flask, jsonify, request

make a new Flask with __name__ and store in app
create list notes

when app gets GET at "/api/notes"
define all notes
    give back jsonify(notes)

when app gets POST at "/api/notes"
define new note
    set data to request.get_json(silent=True) or {}
    set text to str(data.get("text", "")).strip()
    if not text or length of text is more than 500
        give back jsonify({"error": "Send some text, up to 500 characters."}), 400
    set note to {"id": length of notes plus 1, "text": text}
    add note to notes
    give back jsonify(note), 201
== ts server.ts
import express, { Request, Response } from "express";

type Note = { id: number; text: string };
const notes: Note[] = [];
const app = express();
app.use(express.json());

app.get("/api/notes", (_req: Request, res: Response) => {
  res.json(notes);
});

app.post("/api/notes", (req: Request, res: Response) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text || text.length > 500) {
    res.status(400).json({ error: "Send some text, up to 500 characters." });
    return;
  }
  const note: Note = { id: notes.length + 1, text };
  notes.push(note);
  res.status(201).json(note);
});

app.listen(3000, () => console.log("Listening on http://localhost:3000"));`,

`part: udp-messages
title: Sending and receiving UDP messages
group: networking
types: broadcast, video-streaming, raspberry-pi, robotics
about: Send small messages across a network with no connection to set up: status, tally, levels, control.
summary: UDP sends each message (datagram) on its own: no connection, no waiting, no guarantee it arrives or arrives in order. That suits frequent small messages where the newest one matters (levels, positions, tally lights) and is what RTP media streams, OSC and many broadcast control protocols ride on. Keep messages under about 1,400 bytes so they fit in one network packet.
learn: IP addresses and ports; the difference between UDP and TCP.
source: Python socket module | https://docs.python.org/3/library/socket.html | SOCK_DGRAM, sendto, recvfrom and timeouts
== python udp.py
import socket

define send message using text, host="127.0.0.1", port=9000
    description: Sends one UDP message (UTF-8 text) to a host and port.
    using socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sender
        run sender.sendto with text.encode("utf-8"), (host, port)

define listen using port=9000, seconds=5.0, host="0.0.0.0"
    description: Waits up to seconds for one message on a port; gives back the text and who sent it, or nothing. host "0.0.0.0" listens on every network; "127.0.0.1" only on this computer.
    using socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as listener
        run listener.bind with (host, port)
        run listener.settimeout with seconds
        try
            set received to listener.recvfrom(2048)
        if it fails with socket.timeout
            give back None
    set data to item 0 of received
    give back data.decode("utf-8"), item 1 of received`,

`part: mqtt
title: MQTT messages
group: networking
types: smart-home, raspberry-pi, broadcast
about: Publish readings to topics on a broker and subscribe to others: how smart-home devices talk.
summary: MQTT devices don't talk to each other directly: each connects to a broker (Mosquitto, or the one in Home Assistant) and publishes messages to topics like home/studio/temperature, or subscribes to topics to receive them. A retained message is kept by the broker for whoever subscribes next, so a dashboard sees the last reading at once. Home Assistant can turn a topic into a sensor with a few lines of YAML.
learn: Topics and wildcards (+ and #); the broker's role.
source: Eclipse Paho MQTT Python client | https://eclipse.dev/paho/files/paho.mqtt.python/html/index.html | Client, connect, publish, subscribe and the version 2 callbacks
== python sensor.py
import json
python: import paho.mqtt.client as mqtt

define on message using client, userdata, message
    show message.topic and message.payload.decode("utf-8")

define publish reading using client, celsius
    description: Publishes a reading, retained so new subscribers see it at once.
    run client.publish with "home/studio/temperature", json.dumps({"celsius": celsius}), retain=True

define connect using host="localhost"
    set client to mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    set client.on_message to on_message
    run client.connect with host, 1883
    run client.subscribe with "home/studio/#"
    run client.loop_start
    give back client
== yaml configuration.yaml
mqtt:
  sensor:
    - name: "Studio temperature"
      state_topic: "home/studio/temperature"
      value_template: "{{ value_json.celsius }}"
      unit_of_measurement: "°C"
      device_class: temperature`,

`part: rate-limit
title: Rate limiting (token bucket)
group: networking
types: web-app, api-service, chat-bot, smart-home
about: Allow a burst of requests, then a steady rate, and refuse the rest politely.
summary: A token bucket holds up to a set number of tokens and refills at a steady rate. Each request takes a token; with none left, the request is refused (HTTP 429, "too many requests"). The size of the bucket sets how big a burst is allowed; the refill rate sets the steady speed. Bots use the same idea to stay within a chat service's limits.
learn: Timing with a monotonic clock; the Cache with expiry part (one bucket per user, in a dictionary).
source: Token bucket | https://en.wikipedia.org/wiki/Token_bucket | capacity and refill rate
== python limiter.py
import time

define class TokenBucket
    description: Allows a burst of capacity requests, then rate a second.
    define __init__ using self, capacity, rate
        set self.capacity to capacity
        set self.rate to rate
        set self.tokens to capacity
        set self.last to time.monotonic()

    define allow using self
        description: True when a request may go ahead (and takes a token).
        set now to time.monotonic()
        set self.tokens to min(self.capacity, self.tokens plus (now minus self.last) times self.rate)
        set self.last to now
        if self.tokens is at least 1
            decrease self.tokens by 1
            give back yes
        give back no
== js limiter.js
define createBucket using capacity, rate
    give back { capacity: capacity, rate: rate, tokens: capacity, last: performance.now() / 1000 }
define allow using bucket
    description: True when a request may go ahead (and takes a token).
    constant now is performance.now() / 1000
    set bucket.tokens to Math.min(bucket.capacity, bucket.tokens + (now - bucket.last) * bucket.rate)
    set bucket.last to now
    if bucket.tokens is at least 1
        set bucket.tokens to bucket.tokens - 1
        give back true
    give back false`,

// ---------------------------------------------------------------- security

`part: password-hash
title: Storing passwords safely
group: security
types: web-app, online-shop, api-service, phone-app-ios, phone-app-android
about: Never store a password: store a slow, salted hash of it, and compare in constant time.
summary: If a database leaks, stored passwords must not be readable or quick to guess. A password hash function (scrypt, Argon2, bcrypt or PBKDF2) is deliberately slow and memory-hungry, and a random salt per user stops the same password giving the same hash. To check a login, hash what was typed with the stored salt and compare with hmac.compare_digest, which takes the same time whether or not the first characters match. Settings follow OWASP's current advice; raise them as computers get faster.
learn: Hashes versus encryption; salts; why comparison time can leak.
source: OWASP Password Storage Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html | scrypt N=2^17, r=8, p=1, and PBKDF2-HMAC-SHA256 with 600,000 iterations
== python passwords.py
import hashlib
import hmac
import secrets

define hash password using password
    description: A text to store instead of the password: the settings, a random salt and the scrypt hash.
    set salt to secrets.token_hex(16)
    set digest to hashlib.scrypt(password.encode("utf-8"), salt=salt.encode(), n=2 ** 17, r=8, p=1, maxmem=2 ** 28)
    give back "scrypt$17$8$1\${salt}\${digest.hex()}"

define check password using password, stored
    description: Does the password match what was stored? Compared in constant time.
    set parts to stored.split("$")
    set salt to item 4 of parts
    set digest to hashlib.scrypt(password.encode("utf-8"), salt=salt.encode(), n=2 ** int(item 1 of parts), r=int(item 2 of parts), p=int(item 3 of parts), maxmem=2 ** 28)
    give back hmac.compare_digest(digest.hex(), item 5 of parts)
== js passwords.js
define hashPassword using password, salt
    description: PBKDF2-HMAC-SHA256 with 600,000 rounds, from Web Crypto; gives back the hash as hex. The salt is 16 random bytes kept with the hash.
    wait for crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]) and store in key
    wait for crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: 600000 }, key, 256) and store in bits
    give back Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("")`,

`part: random-token
title: Unguessable tokens
group: security
types: web-app, online-shop, api-service, chat-bot, smart-contract, phone-app-ios
about: Make session IDs, reset links and API keys from a cryptographically secure random source.
summary: Ordinary random numbers (random.random, Math.random) can be predicted from earlier ones, so they must never make anything secret. The secrets module in Python and crypto.getRandomValues in browsers use the operating system's secure source. 32 random bytes are far beyond guessing; URL-safe text keeps them usable in links.
learn: Bytes and base64; why predictable randomness is dangerous.
source: Python secrets module | https://docs.python.org/3/library/secrets.html | token_urlsafe and why random isn't for secrets
== python tokens.py
import secrets

define new token
    description: 32 secure random bytes as URL-safe text (about 43 characters).
    give back secrets.token_urlsafe(32)
== js tokens.js
define newToken
    description: 32 secure random bytes as hex text (64 characters).
    constant bytes is crypto.getRandomValues(new Uint8Array(32))
    give back Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")`,

`part: safe-text
title: Showing what people type, safely
group: security
types: webpage, web-app, online-shop, blog, browser-extension
about: Put user text on a page as text, never as HTML, so nobody can slip a script in (cross-site scripting).
summary: If text someone typed is put into innerHTML, a name like <img src=x onerror=…> runs as code in every visitor's browser. Setting textContent (what "set the text of" does) always shows it as plain text. When HTML must be built as text, on a server or in a template, escape &, <, >, " and ' first; Python's html.escape does it.
learn: The difference between text and markup; cross-site scripting (XSS).
source: OWASP Cross Site Scripting Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html | output encoding and safe sinks like textContent
== html index.html
add a text box called comment with hint "Say something"
add a button called post saying "Post"
add a list called comments
== js comments.js
when post is clicked
    get the text of comment and store in said
    note: "add … to the list" sets the new item's text with textContent, so anything typed shows as text, never runs.
    add said to the list comments
define escapeHtml using text
    description: For the rare case HTML must be built as text: & < > " ' become harmless codes.
    give back text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
== python escape.py
import html

define comment html using name, text
    description: A comment as HTML, with what people typed escaped.
    give back "<p><b>{html.escape(name)}</b>: {html.escape(text)}</p>"`,

`part: sql-parameters
title: SQL parameters (no SQL injection)
group: security
types: web-app, online-shop, api-service, database
about: Pass values to a database query separately from the SQL, never by joining them into the text.
summary: Joining what someone typed into SQL text lets them change the query: a name like x' OR '1'='1 can read every row, or delete them. Placeholders (? in SQLite, :name, or $1) send the values separately, so the database never reads them as SQL. Every database library has them; use them for every value that comes from outside.
learn: The Python and SQLite part; what a query plan is.
source: OWASP SQL Injection Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html | parameterised queries as the main defence
== python safe_query.py
import sqlite3

define find customer using db, email
    description: The customer with this email, safely: the ? placeholder sends the email separately from the SQL.
    set cursor to db.execute("SELECT id, name FROM customers WHERE email = ?", (email,))
    give back cursor.fetchone()
== php find.php
<?php
// The same query with PDO: the :email placeholder is filled in by the database, never by joining text.
function findCustomer(PDO $db, string $email): ?array
{
    $query = $db->prepare('SELECT id, name FROM customers WHERE email = :email');
    $query->execute(['email' => $email]);
    $row = $query->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}`,

`part: signed-messages
title: Checking a signed message (HMAC)
group: security
types: web-app, online-shop, api-service, chat-bot, smart-contract
about: Check that a webhook or message really came from who it says, and wasn't changed, using a shared secret.
summary: Payment providers, chat services and devices sign what they send: an HMAC of the exact body with a secret both sides know, often with a time stamp. The receiver works out the same HMAC and compares it in constant time; anything changed on the way, or signed with another key, won't match. Rejecting old time stamps stops someone replaying a captured message later.
learn: Hash functions; secrets in the environment (the Environment variables part).
source: RFC 2104, HMAC: Keyed-Hashing for Message Authentication | https://www.rfc-editor.org/rfc/rfc2104 | the HMAC construction
== python signature.py
import hashlib
import hmac
import time

define sign using secret, body, stamp
    description: The signature of a body sent at a time stamp: HMAC-SHA256 of "stamp.body" as hex.
    give back hmac.new(secret.encode(), f"{stamp}.".encode() + body, hashlib.sha256).hexdigest()

define is genuine using secret, body, stamp, signature, max_age=300
    description: True when the signature matches the body and the time stamp is recent.
    if abs(time.time() minus int(stamp)) is more than max_age
        give back no
    set expected to the result of sign with secret, body, stamp
    give back hmac.compare_digest(expected, signature)
== js signature.js
define isGenuine using secret, body, signatureHex
    description: Checks an HMAC-SHA256 signature with Web Crypto; verify() compares in constant time.
    constant encoder is new TextEncoder()
    wait for crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]) and store in key
    constant signature is new Uint8Array(signatureHex.match(/../g).map((h) => parseInt(h, 16)))
    wait for crypto.subtle.verify("HMAC", key, signature, encoder.encode(body)) and store in ok
    give back ok`,

);
