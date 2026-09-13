Pod::Spec.new do |s|
  s.name         = 'LxAudioCache'
  s.version      = '1.0.0'
  s.summary      = 'Offline audio cache for LxMusicPlayer'
  s.description  = 'Downloads played songs to local Documents for offline replay.'
  s.homepage     = 'https://github.com/fuhaozhi/LxMusicPlayer'
  s.license      = { :type => 'MIT' }
  s.author       = { 'LxMusicPlayer' => 'lx@example.com' }
  s.source       = { :path => '.' }
  s.platforms    = { :ios => '15.1' }
  s.source_files = 'LxAudioCache.h', 'LxAudioCache.m'
  s.frameworks   = 'Foundation'
  s.dependency 'React-Core'
end
