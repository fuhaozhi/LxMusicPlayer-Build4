Pod::Spec.new do |s|
  s.name         = 'LxNowPlaying'
  s.version      = '1.0.0'
  s.summary      = 'Lock screen now playing info + remote commands for LxMusicPlayer'
  s.description  = 'Updates MPNowPlayingInfoCenter and handles remote control events (play/pause/next/prev/seek).'
  s.homepage     = 'https://github.com/fuhaozhi/LxMusicPlayer'
  s.license      = { :type => 'MIT' }
  s.author       = { 'LxMusicPlayer' => 'lx@example.com' }
  s.source       = { :path => '.' }
  s.platforms    = { :ios => '15.1' }
  s.source_files = 'LxNowPlaying.h', 'LxNowPlaying.m'
  s.frameworks   = 'MediaPlayer', 'AVFoundation', 'UIKit'
  s.dependency 'React-Core'
end
