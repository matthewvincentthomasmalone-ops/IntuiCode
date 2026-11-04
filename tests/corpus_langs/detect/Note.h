#import <Foundation/Foundation.h>

@interface Note : NSObject
@property (nonatomic, copy) NSString *title;
- (instancetype)initWithTitle:(NSString *)title;
@end
