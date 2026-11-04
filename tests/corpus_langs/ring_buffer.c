#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CAPACITY 8

/* A fixed-size queue of readings that overwrites the oldest when full. */
typedef struct {
    int *data;
    size_t head;
    size_t count;
    size_t capacity;
} RingBuffer;

RingBuffer *ring_new(size_t capacity) {
    RingBuffer *rb = malloc(sizeof(RingBuffer));
    if (rb == NULL) return NULL;
    rb->data = calloc(capacity, sizeof(int));
    rb->head = 0;
    rb->count = 0;
    rb->capacity = capacity;
    return rb;
}

void ring_push(RingBuffer *rb, int value) {
    size_t tail = (rb->head + rb->count) % rb->capacity;
    rb->data[tail] = value;
    if (rb->count < rb->capacity) {
        rb->count++;
    } else {
        rb->head = (rb->head + 1) % rb->capacity;
    }
}

int ring_average(const RingBuffer *rb) {
    if (rb->count == 0) return 0;
    long sum = 0;
    for (size_t i = 0; i < rb->count; i++) {
        sum += rb->data[(rb->head + i) % rb->capacity];
    }
    return (int)(sum / (long)rb->count);
}

void ring_free(RingBuffer *rb) {
    free(rb->data);
    free(rb);
}

int main(void) {
    RingBuffer *rb = ring_new(CAPACITY);
    char label[16];
    strcpy(label, "average");
    for (int i = 1; i <= 12; i++) ring_push(rb, i * 10);
    printf("%s: %d\n", label, ring_average(rb));
    ring_free(rb);
    return 0;
}
