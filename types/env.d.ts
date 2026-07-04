declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_VLMRUN_API_KEY?: string;
    EXPO_PUBLIC_VLMRUN_BASE_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
