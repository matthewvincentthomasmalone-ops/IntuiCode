import os
import random

import discord

intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)


def roll(expression):
    """Roll dice written like 2d6."""
    count, sides = expression.lower().split("d")
    count = int(count) if count else 1
    rolls = [random.randint(1, int(sides)) for _ in range(count)]
    return rolls, sum(rolls)


@client.event
async def on_message(message):
    if message.author == client.user:
        return
    if message.content.startswith("!roll"):
        parts = message.content.split()
        if len(parts) < 2:
            await message.channel.send("Usage: !roll 2d6")
            return
        try:
            rolls, total = roll(parts[1])
        except ValueError:
            await message.channel.send("I can't read that dice.")
            return
        await message.channel.send(f"{rolls} = {total}")


client.run(os.environ["DISCORD_TOKEN"])
