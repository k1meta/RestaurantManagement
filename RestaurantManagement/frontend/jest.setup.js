// Stabilize Expo/RN screen tests (fonts, async cleanup)
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

jest.mock('@expo-google-fonts/space-grotesk', () => ({
  useFonts: () => [true],
  SpaceGrotesk_700Bold: 'SpaceGrotesk_700Bold',
}));

jest.mock('@expo-google-fonts/work-sans', () => ({
  useFonts: () => [true],
  WorkSans_400Regular: 'WorkSans_400Regular',
}));
