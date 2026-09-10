#import "LxNowPlaying.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

@implementation LxNowPlaying {
  BOOL audioSessionConfigured;
  BOOL commandsInstalled;
  NSMutableArray<id> *commandTargets;
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

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"LxNowPlayingCommand" ];
}

- (void)configureAudioSession {
  if (audioSessionConfigured) return;
  audioSessionConfigured = YES;
  NSError *error = nil;
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback
                                    withOptions:0
                                          error:&error];
  [[AVAudioSession sharedInstance] setActive:YES error:&error];
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

RCT_EXPORT_METHOD(clearNowPlaying) {
  [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
}

- (void)loadArtwork:(NSString *)urlString
         completion:(void (^)(MPMediaItemArtwork *))completion {
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

  id playTarget = [center.playCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self sendEventWithName:@"LxNowPlayingCommand"
                           body:@{@"type" : @"play"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:playTarget];

  id pauseTarget = [center.pauseCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self sendEventWithName:@"LxNowPlayingCommand"
                           body:@{@"type" : @"pause"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:pauseTarget];

  id toggleTarget = [center.togglePlayPauseCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self sendEventWithName:@"LxNowPlayingCommand"
                           body:@{@"type" : @"toggle"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:toggleTarget];

  id nextTarget = [center.nextTrackCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self sendEventWithName:@"LxNowPlayingCommand"
                           body:@{@"type" : @"next"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:nextTarget];

  id prevTarget = [center.previousTrackCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        [self sendEventWithName:@"LxNowPlayingCommand"
                           body:@{@"type" : @"prev"}];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:prevTarget];

  id seekTarget = [center.changePlaybackPositionCommand
      addTargetWithHandler:^MPRemoteCommandHandlerStatus(
                        MPRemoteCommandEvent *_Nonnull event) {
        MPChangePlaybackPositionCommandEvent *posEvent =
            (MPChangePlaybackPositionCommandEvent *)event;
        [self sendEventWithName:@"LxNowPlayingCommand"
                           body:@{
                             @"type" : @"seek",
                             @"position" : @(posEvent.positionTime)
                           }];
        return MPRemoteCommandHandlerStatusSuccess;
      }];
  [commandTargets addObject:seekTarget];
}

@end
