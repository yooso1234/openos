const electron = require("electron");
const { app, Tray, Menu, session } = require('electron')

const logger = require('./logger')

const path = require("path");
const isDev = require("electron-is-dev");
const glob = require('glob');

const OsUtil = require('./main-process/utils/utils-os');
const cmdConst = require("./main-process/net-command/command-const");

const { createLiteralTypeNode } = require("typescript");
const { readConfig } = require("./main-process/configuration/site-config");
const { getOsInfo } = require("./main-process/utils/utils-os");
const { PLATFORM } = require("./main-process/common/common-const");
const { logoutProc } = require("./main-process/main-handler");
const Store = require("./main-process/common/file-store");

const BrowserWindow = electron.BrowserWindow;
const globalShortcut = electron.globalShortcut


// Main Context Menu
const mainContextMenu = Menu.buildFromTemplate([
  // { role: 'appMenu' }
  ...(global.MY_PLATFORM === PLATFORM.MAC ? [{
    label: app.name,
    submenu: [
      { role: 'hide' },
      {
        label: 'Exit',
        click: async () => {
          mainWindow.destroy(-1);
        }
      }
    ]
  }] : []),
  // { role: 'fileMenu' }
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        click: async () => {
          mainWindow.destroy(-1);
        }
      },
      {
        label: 'Logout',
        click: async () => {
          logoutProc();
        }
      },
      {
        label: 'OpenDevTool',
        accelerator: 'F12',
        click: () => { 
          mainWindow.webContents.openDevTools(); 
        }
      },
      {
        label: 'dev tab',
        click: () => { 
          global.IS_DEV = !global.IS_DEV;
          mainWindow.reload();
        }
      }
    ]
  },
  {label: "Edit",
    submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
    ]}
]);

// Tray Context Menu
const trayContextMenu = Menu.buildFromTemplate([
  {
   
    label: 'Exit',
    click: async () => {
      mainWindow.destroy(-1);
    }
  },
  {
    label: 'Logout',
    click: async () => {
      logoutProc();
    }
  },
  {
    label: 'Show',
    click: async () => {
      mainWindow.show()
    }
  },
  {
    label: 'Hide',
    click: async () => {
      mainWindow.hide()
    }
  }
]);

/**
 * GLOBAL 정보는 선언을 하고 사용한다. (중앙관리)
 */
//#region GLOBAL 설정 정보
global.IS_DEV = isDev;
global.MY_PLATFORM = process.platform;

if (global.MY_PLATFORM === PLATFORM.MAC) {
  global.ROOT_PATH = path.join(__dirname, "../../../../../");
} else {
  global.ROOT_PATH = require('fs').realpathSync('./');
}

// 개발모드 일때는 로그경로를 밖으로 뺀다.
switch(global.MY_PLATFORM) {
  case PLATFORM.MAC:
  case PLATFORM.LINUX:
    global.DEV_HOME = path.join(process.env.HOME, 'OpenOS');
    break;

  case PLATFORM.WIN:
  default:
    global.DEV_HOME = path.join(process.env.USERPROFILE, 'OpenOS');
    break;
}

// LOG PATH
if (!global.IS_DEV) {
  global.LOG_PATH = path.join(global.ROOT_PATH,'logs');
} else {
  global.LOG_PATH = path.join(global.DEV_HOME, 'logs');
}

// DOWNLOAD PATH
if (!global.IS_DEV) {
  global.DOWNLOAD_PATH = path.join(global.ROOT_PATH,'download');
} else {
  global.DOWNLOAD_PATH = path.join(global.DEV_HOME,'download');
}


global.MAIN_WINDOW = null;

/**
 * 사용자 정보
 */
global.USER = {
  userId: null,
  userName: '',
  authMethod: '', // 사용처??  그냥 로그인시 넘겨줌 BASE64
  profile:undefined
}

/**
 * 암호화 (보안) 처리 정보
 */
global.ENCRYPT = {
  pwdAlgorithm: 'RC4', //default rc4
  pwdCryptKey: '',
  msgAlgorithm: cmdConst.ENCODE_TYPE_NO,
  fileAlgorithm: cmdConst.ENCODE_TYPE_NO
}
/**
 * 인증 정보
 */
global.CERT = {
  pukCertKey: '',
  challenge: '',
  session: '',
  enc: ''
}
/**
 * 서버 정보
 */
global.SERVER_INFO = {
  DS: {
    "pubip": '',
    "ip": '',
    "port": '',
    "isConnected": false
  },
  CS: {
    "pubip": '',
    "ip": '',
    "port": '',
    "isConnected": false
  },
  NS: {
    "pubip": '',
    "ip": '',
    "port": '',
    "isConnected": false
  },
  PS: {
    "pubip": '',
    "ip": '',
    "port": '',
    "isConnected": false
  },
  FS: {
    "pubip": '',
    "ip": '',
    "port": '',
    "isConnected": false
  },
  SMS: {
    "pubip": '',
    "ip": '',
    "port": '',
    "isConnected": false
  },
  FETCH: {
    "pubip": '',
    "ip": '',
    "port": '',
    "isConnected": false
  }
}
/**
 * 기본 설정 정보
 */
// 국토연구원
// global.SITE_CONFIG = {
//   server_ip: '10.1.1.6', // 운영
//   server_port: '12551',
//   client_version: 651
// }
// 내부 운영
global.SITE_CONFIG = {
  server_ip: '220.230.127.93', // 운영
  server_port: '12551',
  client_version: 651
}
// 개발서버
// global.SITE_CONFIG = {
//   server_ip: '192.168.0.172',
//   server_port: '32551',
//   client_version: 652
// }
/**
 * 조직도 그룹 정보
 */
global.ORG = {
  orgGroupCode: 'ORG001',
  groupCode: '',
  selectedOrg: ''
}

/**
 * RULE - FUNC_COMP_39-서버보관
 */
global.FUNC_COMP_39 = {
  DB_KIND: 0,
  PER_MEM_TABLE: false,
  PER_DISK_TABLE: false,
}
/**
 * ENCODING 정보
 */
global.ENC = "utf-8";

/**
 * 보낸 Command 관리용
 */
global.DS_SEND_COMMAND = {}
global.CS_SEND_COMMAND = {}
global.PS_SEND_COMMAND = {}
global.NS_SEND_COMMAND = {}
global.FS_SEND_COMMAND = {}

/**
 * Connection Check Interval 관리용
 */
global.NS_CONN_CHECK;

/**
 * 대용량 파일 제한
 */
global.BigFileLimit = 1024 * 1024 * 1024;

/**
 * 임시용
 */
global.TEMP = {
  buddyXml: ''
}

/**
 * 2GB 허용 서버 여부
 */
global.USE_FILE2GIGA = false;

/**
 * 사용자 설정 정보
 */
global.USER_CONFIG = new Store({
  configName: 'user-preferences',
  defaults: {
    autoLogin: true,
    autoLoginId:'',
    autoLoginPwd:''
  }
});

//#endregion GLOBAL 설정 정보


/********************************************************************************************************
 * Electron Applicatin Initialize
 *******************************************************************************************************/


var mainWindow = null;
var tray = null;

/**
 * ready
 */
app.on("ready", async () => { //app.whenReady().then(() => { });
  
  logger.info(' ')
  logger.info(' ')
  logger.info('==================================================================')
  logger.info('== UCM MESSENGER START')
  logger.info('==')
  logger.info('== IsDevMode:%s', global.IS_DEV);
  logger.info('== LOCAL_IP:%s  MAC_ADDRESS:%s', OsUtil.getIpAddress(), await OsUtil.getMacAddress());
  logger.info('== PLATFORM:%s OS:%s VERSION:%s  USERNAME:%s', global.MY_PLATFORM, getOsInfo(), process.getSystemVersion(), process.env.USERNAME);
  logger.info('== COMPUTERNAME:%s USERDOMAIN:%s LANG:%s', process.env.COMPUTERNAME, process.env.USERDOMAIN, process.env.LANG);
  logger.info('== ROOT_PATH:%s ', global.ROOT_PATH);
  logger.info('== LOG_PATH:%s', global.LOG_PATH);
  

  if (IS_DEV) {
    logger.info('== USERPROFILE:%s PWD:%s HOME:%s', process.env.USERPROFILE, process.env.PWD, process.env.HOME);
    logger.info('== HOMEPATH:%s', process.env.HOMEPATH);
    logger.info('== INIT_CWD:%s ', process.env.INIT_CWD);
    logger.info('== AppPath:%s', app.getAppPath());
    logger.info('== __dirname:%s', __dirname);
  }
  
  logger.info('==================================================================')


  // Single Instance
  let gotTheLock = app.requestSingleInstanceLock()

  // 개발모드가 아니면 SingleInstance를 적용한다.
  if (!isDev && !gotTheLock) {
    app.quit();
    return;
  }

  //loadMainProcesses
  //logger.debug('loadfile : %s', path.join(__dirname, 'main-process/**/*.js'));
  const files = glob.sync(path.join(__dirname, 'main-process/**/*.js'))
  files.forEach((file) => {
    //logger.debug('loadfile... %s', file);
    require(file) 
  })

  // App Main Context Menu
  Menu.setApplicationMenu(mainContextMenu);

  //const iconPath = isMac ? path.join(__dirname, 'icon.png') : path.join(__dirname, 'icon.ico');
  let iconPath = '';
  switch(global.MY_PLATFORM) {
    case PLATFORM.MAC:
      iconPath = path.join(__dirname, 'icon.png');
      break;
    
    case PLATFORM.LINUX:
      iconPath = path.join(__dirname, 'icon.png');
      break;

    case PLATFORM.WIN:
    default:
      iconPath = path.join(__dirname, 'icon.ico');
      break;
  }

  try {
    // Tray Context Menu
    tray = new Tray(iconPath);
    tray.setToolTip('uc Messenger Application ');
    tray.setContextMenu(trayContextMenu);
    tray.on('double-click', () => {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    })
  } catch(err) {
    logger.error('Tray Icon CreateFail! ', iconPath);
  }

  // config file load
  readConfig();

  // Create Main Window
  mainWindow = new BrowserWindow({
    show: false,
    width: 960,
    height: 650,
    minWidth: 960,
    minHeight: 650,
    webPreferences: { nodeIntegration: true },
    icon: iconPath,
    ... {},
  });

  // 로딩표시 없이 바로 띄우기 위해
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  const options = { extraHeaders: 'pragma: no-cache\n' }
  mainWindow.loadURL(

    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "index.html")}`,  //`file://${path.join(__dirname, "/../build/index.html")}`,
      options
  );

  //mainWindow.on("closed", () => (mainWindow = null));
  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
  //   if (frameName === 'modal') {
  //     // modal로 창을 염
  //     event.preventDefault()
  //     Object.assign(options, {
  //       //modal: true,
  //       parent: mainWindow,
  //       width: 500,
  //       height: 200
  //     })
  //     event.newGuest = new BrowserWindow(options)
  //   }
  // })

  global.MAIN_WINDOW = mainWindow;

  
  //
  //#region Shortcut
  //
  // win
	globalShortcut.register('f5', function() {
		//global.MAIN_WINDOW.reload()
  })
   // mac
  globalShortcut.register('CommandOrControl+R', function() {
		//global.MAIN_WINDOW.reload()
  })
  //#endregion
});

/**
 * second-instance
 */
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // 두 번째 인스턴스를 만들려고 하면 원래 있던 윈도우에 포커스를 준다.
  if (mainWindow) {

    if (mainWindow.isMinimized()) mainWindow.restore();

    mainWindow.show();
    mainWindow.focus();
  }
});

/**
 * activate
 */
app.on("activate", () => {
  if (mainWindow === null) {
    // createWindow();
  }
});

/**
 * quit
 */
app.on('quit', function (evt) {
  session.defaultSession.clearStorageData();

  if (tray) tray.destroy();
  app.exit();

  logger.info('==================================================================')
  logger.info('===================  Application Exit! ===========================')
  logger.info('==================================================================')
});

process.on("uncaughtException", (err) => {
   logger.error('main-process uncaughtException. %s', err)

   // 바로 종료해 버린다.
   if (MAIN_WINDOW) mainWindow.destroy(-1);
   //throw err;
});
/**
 * window-all-closed
 */
/* app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
}); */