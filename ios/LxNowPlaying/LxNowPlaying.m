#import "LxNowPlaying.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

@implementation LxNowPlaying {
  BOOL audioSessionConfigured;
  BOOL commandsInstalled;
  BOOL interruptionObserverInstalled;
  NSMutableArray<id> *commandTargets;
  RCTResponseSenderBlock commandHandler;
  NSTimer *progressTimer;
  double lastElapsed;
  double lastRate;
  double lastDuration;
  BOOL hasProgress;
  NSInteger endGraceCount;
  UIBackgroundTaskIdentifier bgTask;
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init {
  if (self = [super init]) {
    commandTargets = [NSMutableArray array];
  }
  return self;
}

- (void)dealloc {
  [self stopProgressTimer];
  if (interruptionObserverInstalled) {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
  }
}

/// 统一把锁屏远程命令推给 JS。
/// 说明：不用 RCTEventEmitter（新架构下 legacy 事件不可靠），改用回调注册，
/// JS 通过 setCommandHandler 传入回调，命令到达时直接调用回调。
- (void)emitCommand:(NSDictionary *)body {
  if (self->commandHandler) {
    self->commandHandler(@[ body ]);
  }
}

RCT_EXPORT_METHOD(setCommandHandler:(RCTResponseSenderBlock)handler) {
  commandHandler = handler;
}

/// 后台切歌保活：歌曲临近结束时由 JS 调用。
/// 保持音频会话激活 + 申请系统后台任务额度，避免新歌网络加载的空窗期
/// （没有声音输出）被系统判定为"已停止播放"而挂起 App，导致后台不自动切歌。
RCT_EXPORT_METHOD(keepSessionActive) {
  NSError *err = nil;
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback
                                    withOptions:0
                                          error:&err];
  [[AVAudioSession sharedInstance] setActive:YES error:&err];
  // 结束后台任务再重新申请，避免额度被上一次切歌耗尽
  if (bgTask != UIBackgroundTaskInvalid) {
    [[UIApplication sharedApplication] endBackgroundTask:bgTask];
    bgTask = UIBackgroundTaskInvalid;
  }
  bgTask = [[UIApplication sharedApplication]
      beginBackgroundTaskWithName:@"LxMusicNextTrack"
                expirationHandler:^{
                  if (self->bgTask != UIBackgroundTaskInvalid) {
                    [[UIApplication sharedApplication]
                        endBackgroundTask:self->bgTask];
                    self->bgTask = UIBackgroundTaskInvalid;
                  }
                }];
}

/// 每秒按 rate 推进锁屏进度（保证进度条走动、拖动位置有基准）
- (void)startProgressTimer {
  if (progressTimer) return;
  progressTimer = [NSTimer timerWithTimeInterval:1.0
                                          target:self
                                        selector:@selector(tickProgress)
                                        userInfo:nil
                                         repeats:YES];
  [[NSRunLoop mainRunLoop] addTimer:progressTimer
                            forMode:NSRunLoopCommonModes];
}

- (void)tickProgress {
  if (!hasProgress) return;
  // 进度已到/越过终点（切歌空窗期新歌还没 onLoad）：停止推进，避免锁屏卡在旧歌进度
  if (lastDuration > 0 && lastElapsed >= lastDuration - 0.3) {
    // 切歌宽限：最多再推 6 秒，等新歌 setNowPlaying 重置（后台切歌取链有 1~3s 空窗，
    // 立即归 0 会让锁屏进度在空窗期秒停，看起来卡死）
    if (++endGraceCount <= 6) {
      // 保持 lastRate 继续推进（可轻微超过 duration，iOS 锁屏显示 100%）
    } else {
      lastRate = 0;
      endGraceCount = 0;
    }
  } else {
    endGraceCount = 0;
  }
  if (lastRate > 0) lastElapsed += 1.0;
  // 保活节奏：临近结尾（15 秒内）每 2 秒保活一次，平时每 8 秒一次：后台切歌/锁屏进度的持续不依赖 JS onProgress
  // （iOS 后台时 onProgress 会停发，JS 的 keepSessionActive 调用会断链）
  BOOL nearEnd = (lastDuration > 0 && lastElapsed >= lastDuration - 15);
  static NSInteger keepCount = 0;
  keepCount++;
  if (lastRate > 0 && keepCount % (nearEnd ? 2 : 4) == 0) {
    [self keepSessionActive];
  }
  // 每 3 秒唤醒一次 JS 校准真实进度/时长（RN 后台 JS 冻结时 onProgress/onLoad 停发，
  // 原生主动 emit tick，JS 收到后 getCurrentTime/getDuration 校准锁屏，保证切歌后进度不卡死）
  if (lastRate > 0 && keepCount % 3 == 0) {
    [self emitCommand:@{@"type" : @"tick"}];
  }
  NSMutableDictionary *m =
      [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy];
  if (!m) m = [NSMutableDictionary dictionary];
  m[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(lastElapsed);
  m[MPNowPlayingInfoPropertyPlaybackRate] = @(lastRate);
  [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = m;
}

- (void)stopProgressTimer {
  [progressTimer invalidate];
  progressTimer = nil;
  hasProgress = NO;
}

- (void)configureAudioSession {
  if (audioSessionConfigured) return;
  audioSessionConfigured = YES;
  NSError *error = nil;
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback
                                    withOptions:0
                                          error:&error];
  [[AVAudioSession sharedInstance] setActive:YES error:&error];
  [self setupInterruptionObserver];
}

/// 音频中断（来电/其他 App 抢占）结束后自动恢复播放会话并通知 JS 恢复
- (void)setupInterruptionObserver {
  if (interruptionObserverInstalled) return;
  interruptionObserverInstalled = YES;
  [[NSNotificationCenter defaultCenter]
      addObserver:self
         selector:@selector(handleInterruption:)
             name:AVAudioSessionInterruptionNotification
           object:[AVAudioSession sharedInstance]];
}

- (void)handleInterruption:(NSNotification *)note {
  NSDictionary *info = note.userInfo;
  NSNumber *type = info[AVAudioSessionInterruptionTypeKey];
  if (!type) return;
  if (type.unsignedIntegerValue == AVAudioSessionInterruptionTypeEnded) {
    NSNumber *opt = info[AVAudioSessionInterruptionOptionKey];
    if (opt && opt.unsignedIntegerValue == AVAudioSessionInterruptionOptionShouldResume) {
      NSError *err = nil;
      [[AVAudioSession sharedInstance] setActive:YES error:&err];
      [self emitCommand:@{@"type" : @"play"}];
    }
  }
}

RCT_EXPORT_METHOD(setNowPlaying:(NSDictionary *)info) {
  [self configureAudioSession];
  [self installRemoteCommands];

  NSMutableDictionary *now = [NSMutableDictionary dictionary];
  id title = info[@"title"];
  if (title) now[MPMediaItemPropertyTitle] = title;
  id artist = info[@"artist"];
  if (artist) now[MPMediaItemPropertyArtist] = artist;
  id album = info[@"album"];
  if (album) now[MPMediaItemPropertyAlbumTitle] = album;

  NSNumber *duration = info[@"duration"];
  NSNumber *currentTime = info[@"currentTime"];
  NSNumber *rate = info[@"rate"];
  if (duration && [duration doubleValue] > 0) {
    now[MPMediaItemPropertyPlaybackDuration] = duration;
    now[MPNowPlayingInfoPropertyElapsedPlaybackTime] =
        currentTime ? currentTime : @0;
    now[MPNowPlayingInfoPropertyPlaybackRate] = rate ? rate : @1;
    lastElapsed = currentTime ? [currentTime doubleValue] : 0;
    lastRate = rate ? [rate doubleValue] : 1;
    lastDuration = [duration doubleValue];
    hasProgress = YES;
    [self startProgressTimer];
  } else {
    // 切歌/新歌未就绪：清掉推进状态，同时显式清空锁屏进度字段。
    // 若不清空，iOS 锁屏会保留上一首的进度显示（自动切歌后进度条停在上一首结尾）
    now[MPMediaItemPropertyPlaybackDuration] = @0;
    now[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @0;
    now[MPNowPlayingInfoPropertyPlaybackRate] = @0;
    lastElapsed = 0;
    lastRate = 0;
    lastDuration = 0;
    hasProgress = NO;
    [self stopProgressTimer];
  }

  [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;

  id artworkUrl = info[@"artworkUrl"];
  if ([artworkUrl isKindOfClass:[NSString class]] && [artworkUrl length] > 0) {
    [self loadArtwork:artworkUrl
           completion:^(MPMediaItemArtwork *art) {
             if (!art) return;
             dispatch_async(dispatch_get_main_queue(), ^{
               NSMutableDictionary *m =
                   [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo
                       mutableCopy];
               if (!m) m = [NSMutableDictionary dictionary];
               m[MPMediaItemPropertyArtwork] = art;
               [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = m;
             });
           }];
  }
}

RCT_EXPORT_METHOD(getVersion:(RCTResponseSenderBlock)callback) {
  NSString *v = [[NSBundle mainBundle] infoDictionary][@"CFBundleShortVersionString"];
  if (callback) callback(@[v ?: @""]);
}

RCT_EXPORT_METHOD(clearNowPlaying) {
  [self stopProgressTimer];
  if (bgTask != UIBackgroundTaskInvalid) {
    [[UIApplication sharedApplication] endBackgroundTask:bgTask];
    bgTask = UIBackgroundTaskInvalid;
  }
  [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
}

/// 轻量同步锁屏进度基准（JS 在 seek / 回前台校准 / 暂停恢复时调用）。
/// 只更新 elapsed 与 rate，不重建封面、不重启计时器。
RCT_EXPORT_METHOD(updateProgress:(nonnull NSNumber *)currentTime
                            rate:(nonnull NSNumber *)rate) {
  lastElapsed = [currentTime doubleValue];
  lastRate = [rate doubleValue];
  if (hasProgress) {
    NSMutableDictionary *m =
        [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy];
    if (m) {
      m[MPNowPlayingInfoPropertyElapsedPlaybackTime] =
          lastElapsed > 0 ? @(lastElapsed) : @0;
      m[MPNowPlayingInfoPropertyPlaybackRate] = @(lastRate);
      [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = m;
    }
  }
}

- (void)loadArtwork:(NSString *)urlString
         completion:(void (^)(MPMediaItemArtwork *))completion {
  // data URI（base64）直接解码
  if ([urlString hasPrefix:@"data:image"]) {
    NSArray<NSString *> *parts = [urlString componentsSeparatedByString:@","];
    if (parts.count == 2) {
      NSData *data = [[NSData alloc] initWithBase64EncodedString:parts[1]
                                                         options:0];
      UIImage *image = data ? [UIImage imageWithData:data] : nil;
      if (image) {
        MPMediaItemArtwork *art =
            [[MPMediaItemArtwork alloc]
                initWithBoundsSize:image.size
                     requestHandler:^UIImage *_Nonnull(CGSize size) {
                       return image;
                     }];
        completion(art);
        return;
      }
    }
    completion(nil);
    return;
  }
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) {
    completion(nil);
    return;
  }
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithURL:url
      completionHandler:^(NSData *data, NSURLResponse *response,
                          NSError *error) {
        UIImage *image = data ? [UIImage imageWithData:data] : nil;
        if (!image) {
          completion(nil);
          return;
        }
        MPMediaItemArtwork *art =
            [[MPMediaItemArtwork alloc]
                initWithBoundsSize:image.size
                     requestHandler:^UIImage *_Nonnull(CGSize size) {
                       return image;
                     }];
        completion(art);
      }];
  [task resume];
}

- (void)installRemoteCommands {
  if (commandsInstalled) return;
  commandsInstalled = YES;
  MPRemoteCommandCenter *center = [MPRemoteCommandCenter sharedCommandCenter];

  center.playCommand.enabled = YES;
  id playTarget = [center.playCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self emitCommand:@{@"type" : @"play"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:playTarget];

  center.pauseCommand.enabled = YES;
  id pauseTarget = [center.pauseCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self emitCommand:@{@"type" : @"pause"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:pauseTarget];

  center.togglePlayPauseCommand.enabled = YES;
  id toggleTarget = [center.togglePlayPauseCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self emitCommand:@{@"type" : @"toggle"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:toggleTarget];

  center.nextTrackCommand.enabled = YES;
  id nextTarget = [center.nextTrackCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self emitCommand:@{@"type" : @"next"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:nextTarget];

  center.previousTrackCommand.enabled = YES;
  id prevTarget = [center.previousTrackCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self emitCommand:@{@"type" : @"prev"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:prevTarget];

  // 锁屏拖动进度必须显式启用，否则无效
  center.changePlaybackPositionCommand.enabled = YES;
  id seekTarget = [center.changePlaybackPositionCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        MPChangePlaybackPositionCommandEvent *posEvent =
            (MPChangePlaybackPositionCommandEvent *)event;
        [self emitCommand:@{
          @"type" : @"seek",
          @"position" : @(posEvent.positionTime)
        }];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:seekTarget];
}

@end
