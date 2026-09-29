import time

import requests

API_URL = "https://api.example.com/weather"
CITIES = ["London", "Paris", "Tokyo"]
RETRIES = 3


def get_weather(city):
    for attempt in range(RETRIES):
        try:
            response = requests.get(API_URL, params={"city": city}, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data["temperature"]
        except requests.RequestException as error:
            print(f"Attempt {attempt + 1} failed: {error}")
            time.sleep(2)
    return None


def summarize(temps):
    valid = [t for t in temps.values() if t is not None]
    if not valid:
        return "No data"
    average = sum(valid) / len(valid)
    warmest = max(temps, key=lambda c: temps[c] or -999)
    return f"Average {average:.1f}C, warmest is {warmest}"


results = {}
for city in CITIES:
    results[city] = get_weather(city)
    print(city, results[city])
print(summarize(results))
