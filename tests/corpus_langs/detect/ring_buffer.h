#ifndef RING_BUFFER_H
#define RING_BUFFER_H

#include <stddef.h>

typedef struct RingBuffer RingBuffer;

RingBuffer *ring_new(size_t capacity);
void ring_push(RingBuffer *rb, int value);
int ring_average(const RingBuffer *rb);
void ring_free(RingBuffer *rb);

#endif
