export type RootStackParamList = {
  Feed: undefined;
  Share: { sharedText: string };
  Settings: undefined;
  PillarEdit: { pillarId?: string };
  Notes: undefined;
  NoteReader: { fileId: string; name: string };
};
