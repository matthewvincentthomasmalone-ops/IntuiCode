const std = @import("std");

const max_samples = 64;

/// Running statistics over a fixed number of samples.
const Stats = struct {
    samples: [max_samples]f64 = undefined,
    len: usize = 0,

    pub fn add(self: *Stats, value: f64) !void {
        if (self.len >= max_samples) return error.Full;
        self.samples[self.len] = value;
        self.len += 1;
    }

    pub fn mean(self: Stats) f64 {
        if (self.len == 0) return 0;
        var total: f64 = 0;
        for (self.samples[0..self.len]) |s| {
            total += s;
        }
        return total / @as(f64, @floatFromInt(self.len));
    }

    pub fn largest(self: Stats) ?f64 {
        if (self.len == 0) return null;
        var best = self.samples[0];
        var i: usize = 1;
        while (i < self.len) : (i += 1) {
            if (self.samples[i] > best) best = self.samples[i];
        }
        return best;
    }
};

pub fn main() !void {
    var stats = Stats{};
    const readings = [_]f64{ 12.5, 14.0, 13.25, 15.5 };
    for (readings) |r| {
        try stats.add(r);
    }
    std.debug.print("mean {d:.2}\n", .{stats.mean()});
    if (stats.largest()) |big| {
        std.debug.print("largest {d}\n", .{big});
    }
}

test "mean of two samples" {
    var s = Stats{};
    try s.add(2);
    try s.add(4);
    try std.testing.expectEqual(@as(f64, 3), s.mean());
}
