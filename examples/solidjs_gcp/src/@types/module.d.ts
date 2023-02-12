declare interface NodeModule {
  hot: {
    accept(function_?: () => void): void;
    dispose(function_?: (data: unknown) => void): void;
  };
}
