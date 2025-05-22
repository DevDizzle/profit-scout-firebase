
{ pkgs, ... }: {

  # NOTE: This is an excerpt of a complete Nix configuration example.
  # For more information about the dev.nix file in Firebase Studio, see
  # https://firebase.google.com/docs/studio/customize-workspace

  # Enable previews and customize configuration
  idx.previews = {
    enable = true;
    previews = {
      # The following object sets web previews
      web = {
        # Changed to use 'next dev' for a better development preview experience
        command = [
          "next"
          "dev"
          "--turbopack" # From your package.json dev script
          "--port"
          "$PORT"
          "--hostname" # Listen on all interfaces, good for containerized environments
          "0.0.0.0"
        ];
        manager = "web";
        # Optionally, specify a directory that contains your web app
        # cwd = "app/client";
      };
      # The following object sets Android previews
      # Note that this is supported only on Flutter workspaces
      # android = {
      #   manager = "flutter";
      # };
    };
  };
}
