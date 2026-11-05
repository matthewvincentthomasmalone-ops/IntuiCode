-- A player's inventory for a small adventure game.
local json = require("dkjson")

local MAX_SLOTS = 12
local Inventory = {}
Inventory.__index = Inventory

function Inventory.new(owner)
  local self = setmetatable({}, Inventory)
  self.owner = owner
  self.slots = {}
  self.gold = 0
  return self
end

function Inventory:add(item, count)
  count = count or 1
  for _, slot in ipairs(self.slots) do
    if slot.item == item then
      slot.count = slot.count + count
      return true
    end
  end
  if #self.slots >= MAX_SLOTS then
    return false, "inventory is full"
  end
  table.insert(self.slots, { item = item, count = count })
  return true
end

function Inventory:remove(item)
  for i, slot in ipairs(self.slots) do
    if slot.item == item then
      table.remove(self.slots, i)
      return slot.count
    end
  end
  return 0
end

function Inventory:weight(weights)
  local total = 0
  for _, slot in ipairs(self.slots) do
    total = total + (weights[slot.item] or 1) * slot.count
  end
  return total
end

local function save(inv, path)
  local file = assert(io.open(path, "w"))
  file:write(json.encode({ owner = inv.owner, slots = inv.slots, gold = inv.gold }))
  file:close()
end

local bag = Inventory.new("Robin")
bag:add("rope")
bag:add("apple", 3)
print(bag.owner .. " carries " .. bag:weight({ rope = 2 }) .. " kg")
save(bag, "save.json")
