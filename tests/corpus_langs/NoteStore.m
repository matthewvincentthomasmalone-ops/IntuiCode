#import <Foundation/Foundation.h>

static NSString *const kNotesKey = @"notes";

@interface Note : NSObject
@property (nonatomic, copy) NSString *title;
@property (nonatomic, copy) NSString *body;
@property (nonatomic, strong) NSDate *created;
- (instancetype)initWithTitle:(NSString *)title body:(NSString *)body;
@end

@implementation Note
- (instancetype)initWithTitle:(NSString *)title body:(NSString *)body {
    self = [super init];
    if (self) {
        _title = [title copy];
        _body = [body copy];
        _created = [NSDate date];
    }
    return self;
}
@end

@interface NoteStore : NSObject
@property (nonatomic, strong) NSMutableArray<Note *> *notes;
- (void)addNote:(Note *)note;
- (NSArray<Note *> *)notesMatching:(NSString *)text;
@end

@implementation NoteStore

- (instancetype)init {
    self = [super init];
    if (self) {
        _notes = [NSMutableArray array];
    }
    return self;
}

- (void)addNote:(Note *)note {
    [self.notes addObject:note];
    NSLog(@"Saved %@ (%lu notes)", note.title, (unsigned long)self.notes.count);
}

- (NSArray<Note *> *)notesMatching:(NSString *)text {
    NSMutableArray *found = [NSMutableArray array];
    for (Note *note in self.notes) {
        if ([note.title localizedCaseInsensitiveContainsString:text]) {
            [found addObject:note];
        }
    }
    return found;
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NoteStore *store = [[NoteStore alloc] init];
        [store addNote:[[Note alloc] initWithTitle:@"Shopping" body:@"Eggs, flour"]];
        NSLog(@"%lu found", (unsigned long)[store notesMatching:@"shop"].count);
    }
    return 0;
}
