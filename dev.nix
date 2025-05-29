{ pkgs, ... }: {
  idx.previews = {
    enable = true;
    previews = {
      web = {
        command = ["npm", "run", "dev:studio"];
        manager = "web";
      };
    };
  };
}
