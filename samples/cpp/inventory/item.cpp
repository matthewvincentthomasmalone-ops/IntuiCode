#include "item.h"

double stockValue(const Item& item) {
    return item.count * item.price;
}

void restock(Item& item, int amount) {
    item.count += amount;
}
