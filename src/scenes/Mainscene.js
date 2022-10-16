import Phaser from "phaser";
import ControlPanel from "../entity/ControlPanel";

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.state = {};
    this.vendingMachineStatus = false;
  }

  preload() {
    this.load.spritesheet("astronaut", "assets/spritesheets/astronaut3.png", {
      frameWidth: 29,
      frameHeight: 37,
    });
    this.load.image("vendingMachine", "assets/sprites/vendingMachine.png");
    this.load.image("mainroom", "assets/backgrounds/mainroom.png");
  }

  create() {
    const scene = this;
    //BACKGROUND
    this.add.image(0, 0, "mainroom").setOrigin(0);

    //CREATE SOCKET
    this.socket = io();

    //LAUNCH WAITING ROOM
    scene.scene.launch("WaitingRoom", { socket: scene.socket });

    // CREATE OTHER PLAYERS GROUP
    this.otherPlayers = this.physics.add.group();

    // JOINED ROOM - SET STATE
    this.socket.on("setState", function (state) {
      const { roomKey, players, numPlayers } = state;
      scene.physics.resume();

      // STATE
      scene.state.roomKey = roomKey;
      scene.state.players = players;
      scene.state.numPlayers = numPlayers;
    });

    // CONTROL PANELS
    this.controlPanelGroup = this.physics.add.staticGroup({
      classType: ControlPanel,
    });
    this.controlPanelVendingMachine = this.controlPanelGroup.create(
      90,
      160,
      "vendingMachine"
    );

    this.controlPanelVendingMachine.on("pointerdown", () => {
      this.scene.pause();
      this.scene.launch("TaskScene", { ...scene.state, socket: scene.socket });
    });

    // PLAYERS
    this.socket.on("currentPlayers", function (arg) {
      const { players, numPlayers } = arg;
      scene.state.numPlayers = numPlayers;
      Object.keys(players).forEach(function (id) {
        if (players[id].playerId === scene.socket.id) {
          scene.addPlayer(scene, players[id]);
        } else {
          scene.addOtherPlayers(scene, players[id]);
        }
      });
    });

    this.socket.on("newPlayer", function (arg) {
      const { playerInfo, numPlayers } = arg;
      scene.addOtherPlayers(scene, playerInfo);
      scene.state.numPlayers = numPlayers;
    });

    this.socket.on("playerMoved", function (playerInfo) {
      scene.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerInfo.playerId === otherPlayer.playerId) {
          const oldX = otherPlayer.x;
          const oldY = otherPlayer.y;
          otherPlayer.setPosition(playerInfo.x, playerInfo.y);
        }
      });
    });

    this.socket.on("otherPlayerStopped", function (playerInfo) {
      scene.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerInfo.playerId === otherPlayer.playerId) {
          otherPlayer.anims.stop(null, true);
        }
      });
    });
    this.cursors = this.input.keyboard.createCursorKeys();

    // DISCONNECT
    this.socket.on("disconnected", function (arg) {
      const { playerId, numPlayers } = arg;
      scene.state.numPlayers = numPlayers;
      scene.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerId === otherPlayer.playerId) {
          otherPlayer.destroy();
        }
      });
    });
  }

  update() {
    const scene = this;
    //MOVEMENT
    if (this.astronaut && this.astronaut.body) {
      const speed = 225;
      const prevVelocity = this.astronaut.body.velocity.clone();
      // Stop any previous movement from the last frame
      this.astronaut.body.setVelocity(0);
      // Horizontal movement
      if (this.cursors.left.isDown) {
        this.astronaut.body.setVelocityX(-speed);
      } else if (this.cursors.right.isDown) {
        this.astronaut.body.setVelocityX(speed);
      }
      // Vertical movement
      if (this.cursors.up.isDown) {
        this.astronaut.body.setVelocityY(-speed);
      } else if (this.cursors.down.isDown) {
        this.astronaut.body.setVelocityY(speed);
      }
      // Normalize and scale the velocity so that astronaut can't move faster along a diagonal
      this.astronaut.body.velocity.normalize().scale(speed);

      // emit player movement
      var x = this.astronaut.x;
      var y = this.astronaut.y;
      if (
        this.astronaut.oldPosition &&
        (x !== this.astronaut.oldPosition.x ||
          y !== this.astronaut.oldPosition.y)
      ) {
        this.moving = true;
        this.socket.emit("playerMovement", {
          x: this.astronaut.x,
          y: this.astronaut.y,
          roomKey: scene.state.roomKey,
        });
      }
      // save old position data
      this.astronaut.oldPosition = {
        x: this.astronaut.x,
        y: this.astronaut.y,
        rotation: this.astronaut.rotation,
      };
    }
    // CONTROL PANEL OVERLAP
    if (this.astronaut && this.astronaut.body) {
      this.physics.add.overlap(
        scene.astronaut,
        scene.controlPanelVendingMachine,
        scene.highlightControlPanel,
        null,
        this
      );
      //CONTROL PANEL: NOT OVERLAPPED
      scene.checkOverlap(
        scene,
        scene.astronaut,
        scene.controlPanelVendingMachine
      );
    }
  }

  addPlayer(scene, playerInfo) {
    scene.joined = true;
    const astronaut = this.add.sprite(0, 0, "astronaut");
    const text = this.add.text(-40, -40, playerInfo.userName, {
      font: "16px Arial",
      fill: "#ffffff",
    });
    const container = this.add.container(playerInfo.x, playerInfo.y, [
      text,
      astronaut,
    ]);
    // container.setOrigin(0.5, 0.5).setSize(30, 40).setOffset(0, 24);
    this.physics.world.enable(container);

    this.astronaut = container;
  }
  addOtherPlayers(scene, playerInfo) {
    console.log("addOtherPlayers", playerInfo);
    const otherPlayer = scene.add.sprite(
      playerInfo.x + 40,
      playerInfo.y + 40,
      "astronaut"
    );
    otherPlayer.playerId = playerInfo.playerId;
    otherPlayer.userName = playerInfo.userName;
    scene.otherPlayers.add(otherPlayer);
  }

  highlightControlPanel(astronaut, controlPanel) {
    controlPanel.setTint(0xbdef83);
    controlPanel.setInteractive();
  }

  checkOverlap(scene, player, controlPanel) {
    const boundsPlayer = player.getBounds();
    const boundsPanel = controlPanel.getBounds();
    if (
      !Phaser.Geom.Intersects.RectangleToRectangle(boundsPlayer, boundsPanel)
    ) {
      scene.deactivateControlPanel(controlPanel);
    }
  }

  deactivateControlPanel(controlPanel) {
    controlPanel.clearTint();
    controlPanel.disableInteractive();
  }
}
