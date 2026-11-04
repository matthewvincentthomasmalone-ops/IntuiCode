package com.example.weather

import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking

const val RETRIES = 3

data class Reading(val city: String, val celsius: Double, val wind: Double? = null)

sealed class Outlook {
    object Sunny : Outlook()
    object Rainy : Outlook()
    data class Windy(val speed: Double) : Outlook()
}

interface WeatherSource {
    suspend fun fetch(city: String): Reading?
}

class WeatherService(private val source: WeatherSource) {
    private val cache = mutableMapOf<String, Reading>()

    suspend fun current(city: String): Reading? {
        cache[city]?.let { return it }
        repeat(RETRIES) { attempt ->
            val reading = source.fetch(city)
            if (reading != null) {
                cache[city] = reading
                return reading
            }
            delay(500L * (attempt + 1))
        }
        return null
    }

    fun outlook(r: Reading): Outlook = when {
        (r.wind ?: 0.0) > 40.0 -> Outlook.Windy(r.wind!!)
        r.celsius > 18.0 -> Outlook.Sunny
        else -> Outlook.Rainy
    }
}

fun describe(o: Outlook): String = when (o) {
    is Outlook.Sunny -> "Sunny"
    is Outlook.Rainy -> "Take an umbrella"
    is Outlook.Windy -> "Windy at ${o.speed} km/h"
}

fun main() = runBlocking {
    val fake = object : WeatherSource {
        override suspend fun fetch(city: String) = Reading(city, 21.5)
    }
    val service = WeatherService(fake)
    val reading = service.current("Leeds")
    println(reading?.let { describe(service.outlook(it)) } ?: "No data")
}
