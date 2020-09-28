const winston = require('../../winston')

const { parseXmlToJSON } = require('../utils/utils-xmlParser')

const ResData = require('../ResData');
const cmdConst = require('../net-command/command-const');

async function parseRuleInfo(ruleXml) {
    try {
        let result = await parseXmlToJSON(ruleXml)
        result.server_rule_info.function.forEach(element => {

            switch (element.func_code) {
                case 'FUNC_ENCRYPT_2': // Message/Chat Encrypt Algorithm
                    global.ENCRYPT.msgAlgorithm = element.func_value1;
                    winston.info('SET FUNC_ENCRYPT_3 : %s', element.func_value1)
                    break;

                case 'FUNC_ENCRYPT_3': // Password Encrypt Algorithm
                    global.ENCRYPT.pwdAlgorithm = element.func_value1;
                    winston.info('SET FUNC_ENCRYPT_3 : %s', element.func_value1)
                    break;

                case 'FUNC_ENCRYPT_4': // Password Encrypt Key
                    global.ENCRYPT.pwdCryptKey = element.func_value1;
                    winston.info('SET FUNC_ENCRYPT_4 : %s', element.func_value1)
                    break;

                case 'FUNC_ORG_1': // ROOT ORG CODE
                    global.ORG.org_1_root = element.func_value1;
                    winston.info('SET FUNC_ORG_1 : %s', element.func_value1)
                    break;

                case 'FUNC_COMP_39':
                    let options = element.func_value1.split(',');
                    options.forEach((element) => {
                    let option = element.split('=');
                    switch(option[0]) {
                        case 'DB_KIND':
                        global.FUNC_COMP_39.DB_KIND = option[1];
                        break;

                        case 'PER_MEM_TABLE':
                        global.FUNC_COMP_39.PER_MEM_TABLE =  option[1];
                        break;

                        case 'PER_DISK_TABLE':
                        global.FUNC_COMP_39.PER_DISK_TABLE =  option[1];
                        break;
                    }
                    
                    //dicOption[option[0]] = option[1];
                    });

                    // console.log('=========================  FNC_COMP_39')
                    // // debug
                    // for (let key in dicOption) {
                    //   console.log('Key:' + key + " val:" + dicOption[key])
                    // }

                    break;

                case 'FUNC_FILE_7' :
                    global.BigFileLimit = Number(element.func_value1) * 1024 * 1024
                    winston.info('SET FUNC_FILE_7: %s', global.BigFileLimit)
                    break;  
                
                case 'FUNC_ENCRYPT_5' :
                    if (element.func_value1 == cmdConst.ENCODE_TYPE_MOBILE) {
                        global.ENCRYPT.fileAlgorithm = cmdConst.ENCODE_TYPE_NO
                    }

                    global.ENCRYPT.fileAlgorithm = element.func_value1
                    winston.info('SET FUNC_ENCRYPT_5: %s', global.ENCRYPT.fileAlgorithm)
                    break;  
            }
        }); // rule foreach

        return new ResData(true);

    } catch (err) { //parse catch
        winston.error('RULE PARSE ERR!! %s', err)
        return new ResData(false, JSON.stringify(err));
    }
    
}


module.exports = {
    parseRuleInfo: parseRuleInfo,
}
