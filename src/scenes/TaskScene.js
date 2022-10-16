import Phaser from "phaser";

export default class TaskScene extends Phaser.Scene {
  constructor() {
    super("TaskScene");
  }
  init(data) {
    this.roomKey = data.roomKey;
    this.players = data.players;
    this.numPlayers = data.numPlayers;
    this.socket = data.socket;
    this.channel = "hotbeatstv";
  }
  preload() {
    this.load.image("computer", "assets/backgrounds/computer.png");
  }
  create() {
    const scene = this;
    const element = document.createElement("div");
    element.style.color = "#fff";
    element.style.border = "1px solid red";
    element.style.width = "500px";
    element.style.height = "600px";
    element.id = "twitch-embed";
    this.player = scene.add.dom(250, 300, element);

    const chat = document.createElement("iframe");
    chat.id = "twitch-chat-embed";
    chat.src = `https://www.twitch.tv/embed/${this.channel}/chat?parent=localhost`;
    chat.width = "300";
    chat.height = "600";
    this.chat = scene.add.dom(650, 300, chat);

    var embed = new Twitch.Embed("twitch-embed", {
      width: 500,
      height: 400,
      channel: this.channel,
      layout: "video",
      autoplay: true,
      // Only needed if this page is going to be embedded on other websites
      // parent: ["localhost:8080", "localhost"],
    });

    embed.addEventListener(Twitch.Embed.VIDEO_READY, () => {
      var player = embed.getPlayer();
      player.play();
    });

    this.input.keyboard.on("keydown", (event) => {
      console.log(event.code);
      if (event.code === "Escape") {
        this.scene.stop();
        this.scene.resume("MainScene");

        // var player = embed.getPlayer();
        // player.stop();
      }
    });
  }
  tearDown() {}
}
