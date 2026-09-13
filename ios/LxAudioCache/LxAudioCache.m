// 本地歌曲缓存：播放过的歌下载到 Documents/LxAudioCache，下次播放优先读本地（离线可听）。
// 播放本地文件：JS 侧把返回路径拼成 file:// 交给 react-native-video。
#import "LxAudioCache.h"
#import <React/RCTLog.h>

static NSString *const kCacheDirName = @"LxAudioCache";

@implementation LxAudioCache

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSString *)cacheDir {
  NSString *doc =
      NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES)
          .firstObject;
  NSString *dir = [doc stringByAppendingPathComponent:kCacheDirName];
  if (![[NSFileManager defaultManager] fileExistsAtPath:dir]) {
    [[NSFileManager defaultManager] createDirectoryAtPath:dir
                              withIntermediateDirectories:YES
                                               attributes:nil
                                                    error:nil];
  }
  return dir;
}

- (NSString *)safeName:(NSString *)key {
  NSCharacterSet *allowed =
      [NSCharacterSet characterSetWithCharactersInString:
                          @"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"];
  NSString *s = [[key componentsSeparatedByCharactersInSet:[allowed invertedSet]]
      componentsJoinedByString:@"_"];
  return s.length > 0 ? s : @"song";
}

/// 查询某首歌的本地缓存路径；无缓存返回 null
RCT_EXPORT_METHOD(getCachedPath:(NSString *)key
                       resolver:(RCTPromiseResolveBlock)resolve
                       rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *path =
      [[self cacheDir] stringByAppendingPathComponent:[self safeName:key]];
  if ([[NSFileManager defaultManager] fileExistsAtPath:path]) {
    resolve(path);
  } else {
    resolve([NSNull null]);
  }
}

/// 后台下载歌曲到本地缓存（已存在则直接成功）
RCT_EXPORT_METHOD(cacheSong:(NSString *)url
                        key:(NSString *)key
                   resolver:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *dest =
      [[self cacheDir] stringByAppendingPathComponent:[self safeName:key]];
  if ([[NSFileManager defaultManager] fileExistsAtPath:dest]) {
    resolve(@YES);
    return;
  }
  NSURL *u = [NSURL URLWithString:url];
  if (!u) {
    reject(@"bad_url", @"invalid url", nil);
    return;
  }
  NSURLSession *session = [NSURLSession
      sessionWithConfiguration:[NSURLSessionConfiguration defaultSessionConfiguration]];
  NSURLSessionDownloadTask *task =
      [session downloadTaskWithURL:u
                 completionHandler:^(NSURL *loc, NSURLResponse *resp, NSError *err) {
                   if (err || !loc) {
                     reject(@"download_failed",
                            err ? err.localizedDescription : @"no data", err);
                     return;
                   }
                   NSError *mvErr = nil;
                   [[NSFileManager defaultManager] removeItemAtPath:dest error:nil];
                   [[NSFileManager defaultManager] moveItemAtPath:loc.path
                                                           toPath:dest
                                                            error:&mvErr];
                   if (mvErr) {
                     reject(@"move_failed", mvErr.localizedDescription, mvErr);
                     return;
                   }
                   resolve(@YES);
                 }];
  [task resume];
}

/// 缓存总大小（字节）
RCT_EXPORT_METHOD(getCacheSize:(RCTPromiseResolveBlock)resolve
                      rejecter:(RCTPromiseRejectBlock)reject) {
  NSArray *files =
      [[NSFileManager defaultManager] contentsOfDirectoryAtPath:[self cacheDir] error:nil];
  unsigned long long total = 0;
  for (NSString *f in files) {
    NSString *p = [[self cacheDir] stringByAppendingPathComponent:f];
    total +=
        [[[NSFileManager defaultManager] attributesOfItemAtPath:p error:nil] fileSize];
  }
  resolve(@(total));
}

/// 清空缓存，返回释放的字节数
RCT_EXPORT_METHOD(clearCache:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject) {
  NSArray *files =
      [[NSFileManager defaultManager] contentsOfDirectoryAtPath:[self cacheDir] error:nil];
  unsigned long long freed = 0;
  for (NSString *f in files) {
    NSString *p = [[self cacheDir] stringByAppendingPathComponent:f];
    freed +=
        [[[NSFileManager defaultManager] attributesOfItemAtPath:p error:nil] fileSize];
    [[NSFileManager defaultManager] removeItemAtPath:p error:nil];
  }
  resolve(@(freed));
}

@end
