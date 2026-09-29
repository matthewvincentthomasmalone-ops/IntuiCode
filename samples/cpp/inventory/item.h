#pragma once
#include <string>

// One thing in the shop.
struct Item {
    std::string name;
    int count;
    double price;
};

double stockValue(const Item& item);
void restock(Item& item, int amount);
