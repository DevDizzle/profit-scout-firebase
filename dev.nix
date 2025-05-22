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
        # Temporarily changed to only run Next.js for debugging
        command = [
          "npm"
          "run"
          "next:studio" # Runs: next dev --turbopack --port $PORT --hostname 0.0.0.0
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
