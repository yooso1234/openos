const { connectDS, writeCommandDS } = require('../net-core/network-ds-core');
const { sendLog } = require('../ipc/ipc-cmd-sender');

const CommandHeader = require('./command-header');
const CmdCodes = require('./command-code');
const CmdConst = require('./command-const');
const OsUtil = require('../utils/utils-os');
const ResData = require('../ResData');

const CryptoUtil = require('../utils/utils-crypto');
const CmdUtil = require('./command-utils');

/**
 * 서버로 접속요청 합니다.
 */
function reqConnectDS () {
    return connectDS().then(function() {
        sendLog('DS Connect Success!');
    }).catch(function(err){
        sendLog('DS Connect fale!' + JSON.stringify(err));
    })
}


/**
 * Login을 요청합니다.
 * @param {Object} loginData 
 * @param {boolean} connectionTry 
 */
function reqLogin (loginData, connTry=true) {
    return new Promise(async function(resolve, reject) {
        try {
            // connect
            if (connTry && !global.SERVER_INFO.DS.isConnected) {
                await connectDS();
            }

            if (!global.SERVER_INFO.DS.isConnected) 
            {
                reject(new Error('DS Server Not Connected!'));
                return;
            }
            
            // GetServerInfo
            let resData = await reqGetServerInfo(loginData.loginId);
            if (!resData.resCode) {
                reject(new Error(JSON.stringify(resData)));
                return;
            }
            sendLog('LOG IN STEP 1 --- GetServerInfo COMPLETED!' + JSON.stringify(resData));

            // GetUserRules
            resData = await reqGetUserRules(loginData.loginId, loginData.loginPwd);
            if (!resData.resCode) {
                reject(new Error(JSON.stringify(resData)));
                return;
            }
            sendLog('LOG IN STEP 2 --- GetUserRules COMPLETED!' + JSON.stringify(resData));

            // HandshackDS
            resData = await reqHandshackDS(loginData.loginId);
            if (!resData.resCode) {
                reject(new Error(JSON.stringify(resData)));
                return;
            }
            sendLog('LOG IN STEP 3 --- HandshackDS COMPLETED!' + JSON.stringify(resData));

            // SetSessionDS
            resData = await reqSetSessionDS(loginData.loginId);
            if (!resData.resCode) {
                reject(new Error(JSON.stringify(resData)));
                return;
            }
            sendLog('LOG IN STEP 4 --- SetSessionDS COMPLETED!' + JSON.stringify(resData));

            // 마지막 인증까지 완료되었다면 저장한다. 
            global.USER.userId = loginData.loginId;
            global.USER.userPass = loginData.userPass;
            resolve(resData);
        } catch (err) {
            reject(err);
        }
    });
}


/**
 * 서버와 통신가능여부를 확인 합니다. 
 * @param {String} userId 
 */
function reqHandshackDS (userId) {
    return new Promise(function(resolve, reject) {

        // 1.보안키를 받아오고
        var idBuf = Buffer.alloc(CmdConst.BUF_LEN_USERID);
        idBuf.write(userId, global.ENC);

        var pukCertKeyBuf = Buffer.alloc(CmdConst.BUF_LEN_PUKCERTKEY);
        var challengeBuf = Buffer.alloc(CmdConst.BUF_LEN_CHALLENGE);
        var sessionBuf = Buffer.alloc(CmdConst.BUF_LEN_SESSION);

        var dataBuf = Buffer.concat([idBuf, pukCertKeyBuf, challengeBuf, sessionBuf]);
        writeCommandDS(new CommandHeader(CmdCodes.DS_HANDSHAKE, 0, function(resData){
            resolve(resData);
        }), dataBuf);
    });
}

/**
 * reqSetSessionDS
 * @param {*} userId 
 * @param {*} callback 
 */
 function reqSetSessionDS(userId) {
    return new Promise(function(resolve, reject){

        // 2.세션정보 저장요청을 한다.
        let localInfo = OsUtil.getIpAddress() + CmdConst.PIPE_SEP + OsUtil.getMacAddress();
        var localInfoBuf = Buffer.alloc(localInfo.length);
        localInfoBuf.write(localInfo, global.ENC);

        var idBuf = Buffer.alloc(CmdConst.BUF_LEN_USERID);
        idBuf.write(userId, global.ENC);

        var pukCertKeyBuf = Buffer.alloc(CmdConst.BUF_LEN_PUKCERTKEY);
        pukCertKeyBuf.write(global.CERT.pukCertKey, global.ENC);
        
        var challengeBuf = Buffer.alloc(CmdConst.BUF_LEN_CHALLENGE);
        challengeBuf.write(global.CERT.challenge, global.ENC);
        
        var sessionBuf = Buffer.alloc(CmdConst.BUF_LEN_SESSION);
        sessionBuf.write(global.CERT.session, global.ENC);

        var dataBuf = Buffer.concat([idBuf, pukCertKeyBuf, challengeBuf, sessionBuf, localInfoBuf]);
        writeCommandDS(new CommandHeader(CmdCodes.DS_SET_SESSION, 0), dataBuf);

        // setSession은 응답이 없다.
        resolve(new ResData(true));
    });
}

/**
 * 사용자 Rule 정보를 요청합니다.
 */
async function reqGetUserRules(userId, userPwd) {
    return new Promise(function(resolve, reject) {

        var idBuf = Buffer.alloc(CmdConst.BUF_LEN_USERID);
        var passBuf = Buffer.alloc(CmdConst.BUF_LEN_USERPWD);
        var connIpBuf = Buffer.alloc(CmdConst.BUF_LEN_IP);
        var svrSize = Buffer.alloc(CmdConst.BUF_LEN_INT);
        var ruleSize = Buffer.alloc(CmdConst.BUF_LEN_INT);

        idBuf.write(userId, global.ENC);
        passBuf.write(userPwd, global.ENC);

        let localInfo = OsUtil.getIpAddress() + CmdConst.PIPE_SEP + OsUtil.getMacAddress();
        console.log('-------  MAC ADDRESS', localInfo)

        //FC_local_ip + SEP + FC_local_mac_addr
        connIpBuf.write(localInfo, global.ENC);
        var dataBuf = Buffer.concat([idBuf, passBuf, connIpBuf, svrSize, ruleSize]);
        writeCommandDS(new CommandHeader(CmdCodes.DS_GET_RULES, 0, function(resData){
            resolve(resData);
        }), dataBuf);
    });
}

/**
 * 서버정보를 받아옵니다. (ServerUpgradeInfo 와 다름)
 * @param {String} userId 
 * @param {Function} callback 
 */
function reqGetServerInfo(userId) {
    return new Promise(function(resolve, reject) {
        var data =  userId + String.fromCharCode(13) +
                    "PC-" + require("ip").address() + String.fromCharCode(13) +
                    '' + String.fromCharCode(13) +
                    '' + String.fromCharCode(13) +
                    global.SERVER_INFO.DS.ip + String.fromCharCode(13) +
                    'ALL';
        
        var dataBuf = Buffer.from(data, global.ENC);
        var serverSizeBuf = Buffer.alloc(4); // ?
        serverSizeBuf.writeInt32LE(dataBuf.length);

        dataBuf = Buffer.concat([serverSizeBuf, dataBuf]);
        
        let cmdHeader = new CommandHeader(CmdCodes.DS_GET_SERVER_INFO, 0, function(resData){
            resolve(resData)
        });
        writeCommandDS(cmdHeader, dataBuf);
    });
}

/**
 * 서버로 업그레이드 정보를 확인합니다. 
 * 응답을 서버정보를 주나 ServerInfo와는 다름
 */
function reqUpgradeCheckDS (callback) {
    var serverSizeBuf = Buffer.alloc(CmdConst.BUF_LEN_INT); // ?

    var versionStr = global.SITE_CONFIG.version + CmdConst.PIPE_SEP + global.SITE_CONFIG.server_ip;
    var dataBuf = Buffer.concat([serverSizeBuf, Buffer.from(versionStr, "utf-8")]);
    
    writeCommandDS(new CommandHeader(CmdCodes.DS_UPGRADE_CHECK, 0, callback), dataBuf);
}

/**
 * 즐겨찾기 정보를 요청합니다.
 * @param {String} userId 
 * @param {Function} callback 
 */
function reqGetBuddyList(callback) {

    var idBuf = Buffer.alloc(CmdConst.BUF_LEN_USERID);
    idBuf.write(global.USER.userId, global.ENC);
    writeCommandDS(new CommandHeader(CmdCodes.DS_GET_BUDDY_DATA, 0, callback), idBuf);
}

module.exports = {
    reqConnectDS: reqConnectDS,
    reqHandshackDS: reqHandshackDS,
    reqLogin: reqLogin,
    reqUpgradeCheckDS: reqUpgradeCheckDS,
    reqGetBuddyList: reqGetBuddyList
}
