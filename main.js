const electron = require('electron');
const remote = require('electron').remote;
const url = require('url');
const path = require('path');
const { dialog } = require('electron')
const os = require('os');
const si = require('systeminformation');
const mysql = require('mysql');
const ip = require('ip');
const { session } = require('electron');
const osu = require('node-os-utils');
const request = require("request");
const cron = require('node-cron'); 
const fs = require("fs");
const log = require("electron-log");
const exec = require('child_process').exec;
const AutoLaunch = require('auto-launch');
const nodeDiskInfo = require('node-disk-info');
const mv = require('mv');
const uuid = require('node-machine-id');
const psList = require('ps-list');
const csv = require('csvtojson');
const json2csv = require('json2csv').parse;
//var pagination = require('pagination');
const child_process = require('child_process');
const { autoUpdater } = require('electron-updater');

const Tray = electron.Tray;
const iconPath = path.join(__dirname,'images/ePrompto_png.png');

//global.root_url = 'http://localhost/itam_backend';
global.root_url = 'https://developer.eprompto.com/itam_backend_server';
//global.root_url = 'https://www.eprompto.com/itam_backend_server';

const {app, BrowserWindow, screen, ipcMain} = electron;
let reqPath = path.join(app.getAppPath(), '../');
const detail =  reqPath+"syskey.txt";
var csvFilename = reqPath + 'utilise.csv';
var time_file = reqPath + 'time_file.txt';

let mainWindow;
let categoryWindow;
let settingWindow;
let display;
let width;
let startWindow;
let tabWindow;
let child;
let ticketIssue;
let tray = null;
let count = 0;

app.on('ready',function(){

	log.transports.file.level = 'info';
	log.transports.file.maxSize = 5 * 1024 * 1024;
	log.transports.file.file = reqPath + '/log.log';
	log.transports.file.streamConfig = { flags: 'a' };
	log.transports.file.stream = fs.createWriteStream(log.transports.file.file, log.transports.file.streamConfig);
	log.transports.console.level = 'debug';
	
		session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
			.then((cookies) => {
				if(cookies.length == 0){
					if(fs.existsSync(detail)){
						fs.readFile(detail, 'utf8', function (err,data) {
							if (err) {
							return console.log(err);
							}
							
							var stats = fs.statSync(detail);
							var fileSizeInBytes = stats["size"];
							if(fileSizeInBytes > 0){
								const cookie = {url: 'http://www.eprompto.com', name: data, value: '', expirationDate: 99999999999}
								session.defaultSession.cookies.set(cookie, (error) => {
									if (error) console.error(error)
								})
							}
						});
					}
					
				}else{
					if(fs.existsSync(detail)) {
						var stats = fs.statSync(detail);
						var fileSizeInBytes = stats["size"];
						if(fileSizeInBytes == 0){
							fs.writeFile(detail, cookies[0].name, function (err) { 
								if (err) return console.log(err);
							});
						}
					} else {
						fs.writeFile(detail, cookies[0].name, function (err) { 
							if (err) return console.log(err);
						});
					}
				}
				//readSecurityCSVFile('C:\\ITAMEssential\\EventLogCSV\\securitylog.csv',cookies[0].name);
			    SetCron(cookies[0].name); 
				checkSecuritySelected(cookies[0].name);
			}).catch((error) => {
			console.log(error)
			})

			let autoLaunch = new AutoLaunch({
			name: 'ITAM',
			});
			autoLaunch.isEnabled().then((isEnabled) => {
			if (!isEnabled) autoLaunch.enable();
			});

		cron.schedule("0 */3 * * *", function() { 
			
			session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
				.then((cookies) => {
				if(cookies.length > 0){
					readCSVUtilisation();
				}
				}).catch((error) => {
				//console.log(error)
				})
		}, {
				scheduled: true,
				timezone: "Asia/Kolkata"	
		});


		cron.schedule("0 55 23 * * *", function() { 
			
			session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
				.then((cookies) => {
				if(cookies.length > 0){
					MoveFile();
				}
				}).catch((error) => {
				console.log(error)
				})
		}, {
				scheduled: true,
				timezone: "Asia/Kolkata"	
		});

		var now_datetime = new Date();
		var options = { hour12: false, timeZone: "Asia/Kolkata" };
		now_datetime = now_datetime.toLocaleString('en-US', options);
		var only_date = now_datetime.split(", ");

		fs.writeFile(time_file, now_datetime, function (err) { 
			if (err) return console.log(err);
		});

		setGlobalVariable();

		// session.defaultSession.clearStorageData([], function (data) {
		//     console.log(data);
		// })	
	
});

function SetCron(sysKey){ 
	require('dns').resolve('www.google.com', function(err) {
		if (err) {
		   console.log("No connection");
		} else { 
			request({
				uri: root_url+"/check_clientno.php",
				method: "POST",
				form: {
				  funcType: 'cloudservercrontime',
				  syskey: sysKey
				}
			  }, function(error, response, body) { 
				  if(error){
					  log.info('Error while fetching global data '+error);					   
				  }else{ 
					output = JSON.parse(body); 
					if(output.status == 'valid'){ 
						crontime_array = output.result;
						crontime_array.forEach(function(slot){ 
						  cron.schedule("0 "+slot[0]+" "+slot[1]+" * * *", function() { 
						  session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
							.then((cookies) => {
							  if(cookies.length > 0){
								slot_time = slot[1]+':'+slot[0];
								updateAssetUtilisation(slot_time);
							  }
							}).catch((error) => {
							  console.log(error)
							})
						   }, {
							 scheduled: true,
							 timezone: "Asia/Kolkata" 
						});
						});
					}
				  }
			});

		}
	});
}

function checkSecuritySelected(system_key){
	require('dns').resolve('www.google.com', function(err) {
	  if (err) {
		 console.log("No connection");
	  } else {

		require('dns').resolve('www.google.com', function(err) {
			if (err) {
			   console.log("No connection");
			   global.NetworkStatus = 'No';
			} else {
				console.log("CONNECTED");
				global.NetworkStatus = 'Yes';
			   request({
					uri: root_url+"/check_clientno.php",
					method: "POST",
					form: {
					   funcType: 'checkSecuritySelected',
					   sys_key: system_key
					}
				  }, function(error, response, body) {
					  if(error){
						  log.info('Error while fetching global data '+error);						   
					  }else{ 
						  output = JSON.parse(body); 
						  if(output.status == 'valid'){
							var asset_id = output.asset_id;
							var last_update = output.last_date;
							 fs.access("C:/ITAMEssential", function(error) {
							  if (error) {
								fs.mkdir("C:/ITAMEssential", function(err) {
								  if (err) {
									console.log(err)
								  } else {
									 fs.mkdir("C:/ITAMEssential/EventLogCSV", function(err) {
									  if (err) {
										console.log(err)
									  } else {
										checkforbatchfile(last_update);
									  }
									})
								  }
								})
							  } else {
								checkforbatchfile(last_update);
							  }
							})
			  
							fetchEventlogData(asset_id,system_key,last_update); 
						  }
					  }
					  
				  });
			}
		  });
	  }
	});
  }

function checkforbatchfile(last_update){
	const path1 = 'C:/ITAMEssential/logadmin.bat';
	const path2 = 'C:/ITAMEssential/execScript.bat';
	const path3 = 'C:/ITAMEssential/copy.ps1';
  
	if (!fs.existsSync(path1)) {
	  fs.writeFile(path1, '@echo off'+'\n'+'runas /profile /user:itam /savecred "c:\\ITAMEssential\\execScript.bat"', function (err) {
		if (err) throw err;
		console.log('File1 is created successfully.');
	  });
	}
  
	if (!fs.existsSync(path2)) {
	  fs.writeFile(path2, '@echo off'+'\n'+'START /MIN c:\\windows\\system32\\WindowsPowerShell\\v1.0\\powershell.exe -executionpolicy bypass c:\\ITAMEssential\\copy.ps1', function (err) {
		if (err) throw err;
		console.log('File2 is created successfully.');
	  });
	}
  
	var command = '$aDateTime = [dateTime]"'+last_update+'"'+'\n'+'Get-EventLog -LogName Security -After ($aDateTime) -Before (Get-Date)  | Export-Csv -Path C:\\ITAMEssential\\EventLogCSV\\securitylog.csv'
  
	fs.writeFile(path3, command, function (err) {
		if (err) throw err;
		console.log('File3 is created successfully.');
	});
}

function fetchEventlogData(assetid,system_key,last_update){

	require('dns').resolve('www.google.com', function(err) {
	  if (err) {
		 console.log("No connection");
	  } else {
		require('dns').resolve('www.google.com', function(err) {
			if (err) {
			   console.log("No connection");
			   global.NetworkStatus = 'No';
			} else {
				console.log("CONNECTED");
				global.NetworkStatus = 'Yes';
			   request({
					uri: root_url+"/check_clientno.php",
					method: "POST",
					form: {
					   funcType: 'getSecurityCrontime',
					   sys_key: system_key
					}
				  }, function(error, response, body) {
					  if(error){
						  log.info('Error while fetching global data '+error);						   
					  }else{ 
						output = JSON.parse(body); 
						if(output.status == 'valid'){
							security_crontime_array = output.result; 
							security_crontime_array.forEach(function(slot){ 
							   cron.schedule("0 "+slot[1]+" "+slot[0]+" * * *", function() { 
								  session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
									.then((cookies) => {
									  if(cookies.length > 0){
			
										 child_process.exec('C:\\ITAMEssential\\logadmin', function(error, stdout, stderr) {
											  console.log(stdout);
										  });
									  
										getEventIds('System',assetid,function(events){
										  var command = '$aDateTime = [dateTime]"'+last_update+'"'+'\n'+'Get-EventLog -LogName System -InstanceId '+events+' -After ($aDateTime) -Before (Get-Date)  | Export-Csv -Path C:\\ITAMEssential\\EventLogCSV\\systemlog.csv';
										  //var command = 'Get-EventLog -LogName System -InstanceId '+events+' -After ([datetime]::Today)| Export-Csv -Path C:\\ITAMEssential\\EventLogCSV\\systemlog.csv';
										  exec(command, {'shell':'powershell.exe'}, (error, stdout, stderr)=> {
											  console.log(stdout);
										  })
										});
			
										getEventIds('Application',assetid,function(events){
										  var command = '$aDateTime = [dateTime]"'+last_update+'"'+'\n'+'Get-EventLog -LogName Application -InstanceId '+events+' -After ($aDateTime) -Before (Get-Date)  | Export-Csv -Path C:\\ITAMEssential\\EventLogCSV\\applog.csv';
										  //var command = 'Get-EventLog -LogName Application -InstanceId '+events+' -After ([datetime]::Today)| Export-Csv -Path C:\\ITAMEssential\\EventLogCSV\\applog.csv';
										  exec(command, {'shell':'powershell.exe'}, (error, stdout, stderr)=> {
											  console.log(stdout);
										  })
										});
									  }
									}).catch((error) => {
									  console.log(error)
									})
								   }, {
									 scheduled: true,
									 timezone: "Asia/Kolkata" 
								});
							   
			
								var minute = Number(slot[1])+Number(4); 
								if(minute > 59){
								  slot[0] = Number(slot[0])+Number(1);
								  minute = Number(minute) - Number(60);
								}
			
								cron.schedule("0 "+minute+" "+slot[0]+" * * *", function() { 
								  session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
									.then((cookies) => {
									  if(cookies.length > 0){
										//read from csv
										  try {
											if (fs.existsSync('C:/ITAMEssential/EventLogCSV/securitylog.csv')) {
											  readSecurityCSVFile('C:\\ITAMEssential\\EventLogCSV\\securitylog.csv',system_key);
											}
										  } catch(err) {
											console.error(err)
										  }
			
										  try {
											if (fs.existsSync('C:/ITAMEssential/EventLogCSV/systemlog.csv')) {
											  readCSVFile('C:\\ITAMEssential\\EventLogCSV\\systemlog.csv',system_key);
											}
										  } catch(err) {
											console.error(err)
										  }
			
										  try {
											if (fs.existsSync('C:/ITAMEssential/EventLogCSV/applog.csv')) {
											  readCSVFile('C:\\ITAMEssential\\EventLogCSV\\applog.csv',system_key);
											}
										  } catch(err) {
											console.error(err)
										  }
									  }
									}).catch((error) => {
									  console.log(error)
									})
								   }, {
									 scheduled: true,
									 timezone: "Asia/Kolkata" 
								});
							});
						}
					  }
			    });
			}
		});
	  }
	});
}

function readSecurityCSVFile(filepath,system_key){ 
	//var main_arr=[];
	var final_arr=[];
	var new_Arr = [];
	var ultimate = [];
	const converter=csv()
	 .fromFile(filepath)
	 .then((json)=>{
		 if(json != []){
			for (j = 1; j < json.length; j++) {  
			   // if(json[j]['field12'] == 'Security' ){  
				 if(final_arr.indexOf(json[j]['field11']) == -1 && final_arr.indexOf(json[j]['field12']) == -1){ //to avoid duplicate entry into the array
					 final_arr.push(json[j]['field11'],json[j]['field12']);
					 new_Arr = [json[j]['field11'],json[j]['field12']];
					 ultimate.push(new_Arr);
				 }
			   //}
			}
 
			 require('dns').resolve('www.google.com', function(err) {
			   if (err) {
				  console.log("No connection");
			   } else {
				  request({
					uri: root_url+"/check_clientno.php",
					method: "POST",
					form: {
					   funcType: 'addsecuritywinevent',
					   sys_key: system_key,
					   events: ultimate
					}
				  }, function(error, response, body) {
					  if(error){
						  log.info('Error while fetching global data '+error);						   
					  }else{ 
						  console.log('added addsecuritywinevent');
					  }
				  });
			   }
			 }); 
		 }
	 })
 }

 function readCSVFile(filepath,system_key){
	var final_arr=[];
	var new_Arr = [];
	var ultimate = [];
	const converter=csv()
	 .fromFile(filepath)
	 .then((json)=>{ 
		 if(json != []){ 
			for (j = 1; j < json.length; j++) { 
			   if(final_arr.indexOf(json[j]['field11']) == -1){ //to avoid duplicate entry into the array
				   final_arr.push(json[j]['field11']);
				   new_Arr = [json[j]['field11'],json[j]['field12']];
				   ultimate.push(new_Arr);
			   }
			}
			require('dns').resolve('www.google.com', function(err) {
			   if (err) {
				  console.log("No connection");
			   } else {
					request({
						uri: root_url+"/check_clientno.php",
						method: "POST",
						form: {
						funcType: 'addwinevent',
						sys_key: system_key,
						events: ultimate
						}
					}, function(error, response, body) {
						if(error){
							log.info('Error while fetching global data '+error);						   
						}else{ 
							console.log('added addwinevent');
						}
					});
			   }
			 });  
		 }
	 })
 }
 
 var getEventIds = function(logname,asset_id,callback) { 
   var events = '';
   require('dns').resolve('www.google.com', function(err) {
	 if (err) {
		console.log("No connection");
	 } else {
		request({
			uri: root_url+"/check_clientno.php",
			method: "POST",
			form: {
				funcType: 'getEventId',
				lognametype: logname,
				asset_id: asset_id
			}
		}, function(error, response, body) {
			if(error){
				log.info('Error while fetching global data '+error);						   
			}else{ 
				output = JSON.parse(body); 
				if(output.status == 'valid'){
					if(output.result.length > 0){
						for (var i = 0; i < output.result.length-1 ; i++) {
						events = events + output.result[i]+',';
						}
						events = events + output.result[output.result.length-1];
					}
					callback(events);
				}
			}
		});
	 }
   });
 }
 

function setGlobalVariable(){
	tray = new Tray(iconPath);
	display = electron.screen.getPrimaryDisplay();
	width = display.bounds.width;

	si.system(function(data) {
		sys_OEM = data.manufacturer;
		sys_model = data.model;
		global.Sys_name = sys_OEM+' '+sys_model;
	});

	session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
	  .then((cookies) => { 
	  	if(cookies.length > 0){ 
	  		require('dns').resolve('www.google.com', function(err) {
			  if (err) {
			     console.log("No connection");
			     global.NetworkStatus = 'No';
			  } else {
			  	console.log("CONNECTED");
			  	global.NetworkStatus = 'Yes';
			     request({
					  uri: root_url+"/check_clientno.php",
					  method: "POST",
					  form: {
					  	funcType: 'openFunc',
					    sys_key: cookies[0].name
					  }
					}, function(error, response, body) {
						if(error){
							log.info('Error while fetching global data '+error);
													 
						}else{ 
							console.log('CONNECTED');
							output = JSON.parse(body); 
							if(output.status == 'valid'){ 
								asset_id = output.result[0];
				      		    client_id = output.result[1];
					    		global.clientID = client_id;
					    		global.NetworkStatus = 'Yes';
					    		global.downloadURL = __dirname;
					    		global.assetID = asset_id;
					    		global.deviceID = output.result[3];
					    		global.userName = output.loginPass[0];
				     		 	global.loginid = output.loginPass[1];
				     		 	global.sysKey = cookies[0].name;
						     	updateAsset(asset_id);
						     	addAssetUtilisation(asset_id,client_id);
						     	
							}
						}
						
					});
			  }
			});


			mainWindow = new BrowserWindow({
				width: 300,
				height: 470,
				//frame: false,
			 	x: width - 370,
		        y: 250,
				webPreferences: {
		            nodeIntegration: true
		        }
			});

	  		mainWindow.loadURL(url.format({
				pathname: path.join(__dirname,'index.html'),
				protocol: 'file:',
				slashes: true
			}));

			mainWindow.once('ready-to-show', () => {
				autoUpdater.checkForUpdatesAndNotify();
			});

			tray.on('click', function(e){
			    if (mainWindow.isVisible()) {
			      mainWindow.hide()
			    } else {
			      mainWindow.show()
			    }
			});

			mainWindow.on('close', function (e) {
			  if (electron.app.isQuitting) {
			   return
			  }
			  e.preventDefault()
			  mainWindow.hide()
			  // if (child.isVisible()) {
			  //     child.hide()
			  //   } 
			 });

			//mainWindow.on('closed', () => app.quit());
	  	}
	  	else{
	  		startWindow = new BrowserWindow({
				width: 300,
				height: 400,
				//frame: false,
			 	x: width - 370,
		        y: 310,
				webPreferences: {
		            nodeIntegration: true
		        }
			});

	  		 startWindow.loadURL(url.format({
				pathname: path.join(__dirname,'login.html'),
				protocol: 'file:',
				slashes: true
			}));
	  	}
	  }).catch((error) => {
	    console.log(error)
	  })	  
}

function setPassLogin(client_id){

	request({
	  uri: root_url+"/check_clientno.php",
	  method: "POST",
	  form: {
	  	funcType: 'setPasslogin',
	    clientID: client_id
	  }
	}, function(error, response, body) {  
		if(error){
			log.info('Error while setting password '+error);
									 
		}else{
			output = JSON.parse(body);
			if(output.status == 'valid'){ 
				global.userName = output.result[0];
		     	global.loginid = output.result[1];
			}
		}

	});
}


function updateAssetUtilisation(slot){ 
	log.info('Hit the function to fetch the system detail');
	const cpu = osu.cpu;
 	var active_user_name = "";
 	var ctr = 0;
 	var app_list = [];
 	const data = [];
	var app_name_list = "";
	var time_off = "";
	var avg_ctr = 0; 
	var avg_cpu = 0;
	var avg_hdd = 0;
	var avg_ram = 0;

	var todays_date = new Date();
	todays_date = todays_date.toISOString().slice(0,10);

	if(fs.existsSync(time_file)) { 
       var stats = fs.statSync(time_file); 
	   var fileSizeInBytes = stats["size"]; 
	   if(fileSizeInBytes > 0){
	   	  	fs.readFile(time_file, 'utf8', function (err,data) {
			  if (err) {
			    return console.log(err);
			  }
			  time_off = data;
			});
	   }
    }

	session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
	  .then((cookies1) => {

	  	const disks = nodeDiskInfo.getDiskInfoSync();
		total_mem = (os.totalmem()/(1024*1024*1024)).toFixed(1);
		free_mem = (os.freemem()/(1024*1024*1024)).toFixed(1);
		today = Math.floor(Date.now() / 1000);
		utilised_RAM = (((total_mem - free_mem)/total_mem)*100).toFixed(1);

		hdd_total = hdd_used = 0;
		hdd_name = '';
		for (const disk of disks) {
	       
	       hdd_total = hdd_total + disk.blocks;
	       hdd_used = hdd_used + disk.used;
	       used_drive = (disk.used/(1024*1024*1024)).toFixed(2); 
	       hdd_name = hdd_name.concat(disk.mounted+' '+used_drive+' / ');
	        
	    }

	    hdd_total = hdd_total/(1024*1024*1024);
	    hdd_used = hdd_used/(1024*1024*1024);

		cpu.usage()
		  .then(info => { 

		  		if(info == 0){
		  			info = 1;
		  		}
			    getActiveUser(function(data){
					active_user_name = data[0];
					ctr = data[1];
					
					getAppUsedList(function(app_data){
						app_name_list = app_data;
						require_path = reqPath + 'utilise.csv';
						//read from csv and clculate the avg before inserting data 
						if (fs.existsSync(require_path)){ 
						    const converter=csv()
							.fromFile(reqPath + '/utilise.csv')
							.then((json)=>{
								if(json != []){
									//console.log(json);
									for (j = 0; j < json.length; j++) {
										if(json[j]['date'] == todays_date ){ 
											if(json[j]['time_slot'] == slot){ 	
												avg_ctr = Number(avg_ctr) + 1; 
												avg_cpu = avg_cpu + Number(json[j]['cpu']);
												avg_ram = avg_ram + Number(json[j]['ram']);
												avg_hdd = avg_hdd + Number(json[j]['hdd']);
											}else{
												avg_ctr = 1;
												avg_cpu = info;
												avg_ram = utilised_RAM;
												avg_hdd = hdd_used;
											}
										}
									}
								}
								avg_cpu = avg_cpu/avg_ctr;
								avg_ram = avg_ram/avg_ctr;
								avg_hdd = avg_hdd/avg_ctr;
								CallUpdateAssetApi(cookies1[0].name,todays_date,slot,avg_cpu,avg_ram,avg_hdd,ctr,active_user_name,app_name_list,utilised_RAM,info,hdd_used,total_mem,hdd_total,hdd_name,time_off);
							})
						}else{
							CallUpdateAssetApi(cookies1[0].name,todays_date,slot,info,utilised_RAM,hdd_used,ctr,active_user_name,app_name_list,utilised_RAM,info,hdd_used,total_mem,hdd_total,hdd_name,time_off);
						}
					});
				});
		})
	}).catch((error) => {
	    console.log(error)
	})		
}

function CallUpdateAssetApi(sys_key,todays_date,slot,cpu_used,ram_used,hdd_used,active_usr_cnt,active_usr_nm,app_name_list,csv_ram_util,info,hdd_used,total_mem,hdd_total,hdd_name,time_off){
	var date_ob = new Date();
	var hours = date_ob.getHours();
	var minutes = date_ob.getMinutes();
	var current_time  = hours + ":" + minutes;
	var cpuCount = os.cpus().length;

	request({
	  uri: root_url+"/check_clientno.php",
	  method: "POST",
	  form: {
	  	funcType: 'updateserverassetUtilisation',
	    sys_key: sys_key,
	    cpu_util: cpu_used,
	    slot: slot,
	    ram_util: ram_used,
	    total_mem: total_mem,
	    hdd_total : hdd_total,
	    hdd_used : hdd_used,
	    hdd_name : hdd_name,
	    active_user: active_usr_cnt,
	    active_user_name: active_usr_nm,
	    app_used: app_name_list,
	    cpu_cnt: cpuCount,
	    timeoff: time_off
	  }
	}, function(error, response, body) { 
		if(error){
			log.info('Error as connection not accepted '+error);
		}else{
			output = JSON.parse(body); 
			if(output.status == 'invalid'){ 
				log.info('Error while updating asset detail ');
			}else{
				log.info('Updated asset detail successfully ');

	    		data = [
					  {
					    date: todays_date,
					    time_slot: slot,
					    time_current: current_time,
					    cpu: info,
					    ram: csv_ram_util,
					    hdd: hdd_used,
					    active_user: active_usr_cnt,
					    active_user_name: active_usr_nm,
					    app_used: app_name_list
					  }
					];

				if (!fs.existsSync(csvFilename)) {
			        rows = json2csv(data, { header: true });
			    } else {
			        // Rows without headers.
			        rows = json2csv(data, { header: false });
			    }

			     // Append file function can create new file too.
			    fs.appendFileSync(csvFilename, rows);
			    // Always add new line if file already exists.
			    fs.appendFileSync(csvFilename, "\r\n");

				readCSVUtilisation();
			}
		}
		data = [
			  {
			    date: todays_date,
			    time_slot: slot,
			    time_current: current_time,
			    cpu: info,
			    ram: csv_ram_util,
			    hdd: hdd_used,
			    active_user: active_usr_cnt,
			    active_user_name: active_usr_nm,
			    app_used: app_name_list
			  }
			];

		if (!fs.existsSync(csvFilename)) {
	        rows = json2csv(data, { header: true });
	    } else {
	        // Rows without headers.
	        rows = json2csv(data, { header: false });
	    }

	     // Append file function can create new file too.
	    fs.appendFileSync(csvFilename, rows);
	    // Always add new line if file already exists.
	    fs.appendFileSync(csvFilename, "\r\n");
	});
}

var getActiveUser = function(callback) {
   var active_user_name = "";
   var ctr=0;
   var data = [];
   exec(`PowerShell.exe quser`, (error, stdout, stderr) => {
	  if (error) {
	    log.info('Error while executing quser '+error);
	  }else{
	  	   var output = [];
		   res = stdout.split('\n');
		   res.forEach(function(line) {
		       line = line.trim();
		       var newStr = line.replace(/  +/g, ' ');
		        var parts = newStr.split(' ');
		        output.push({name: parts[0], state: parts[2] });
		    });
		  
		   var i;
			for (i = 1; i < output.length; i++) {
				if(output[i].state != 'Disc' ){
					if(output[i].state != 'undefined'){
						active_user_name += output[i].name + " / ";
						ctr = ctr + 1;
						//text += output[i].name;
					}
				}
			}
			active_user_name = active_user_name.replace(/>/g, '');
			//text = text.replace(/,\s*$/, "");
			ctr = ctr - 1;
			//text = output.length-2;
			data[0] =  active_user_name;
			data[1] = ctr;
			callback(data);
		}
	});
};

var getAppUsedList = function(callback) {
	var app_name_list  = "";
	var app_list = [];

	psList().then(data => {
	    data.forEach(function(per_data){ 
	    	 if(app_list.indexOf(per_data.name) == -1){ //to avoid duplicate entry into the array
	    		app_list.push(per_data.name);
	    	 }
	    });

	    //loop to check whether the specified app is present in app_list array
	    var j;
		for (j = 0; j < app_list.length; j++) { 
			app_name_list += app_list[j] + " / ";
			// if(app_list[j] == 'EXCEL.EXE' || app_list[j] == 'wordpad.exe' || app_list[j] == 'WINWORD.EXE' || app_list[j] == 'tally.exe' ){
			// 	app_name_list += app_list[j] + " / ";
			// }
		}
		callback(app_name_list);
	});
};

function readCSVUtilisation(){
	//var inputPath = reqPath + '/utilise.csv';
	session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
	.then((cookies) => {
	  	require_path = reqPath + 'utilise.csv';
					 
		if (fs.existsSync(require_path)){ 
		    const converter=csv()
			.fromFile(reqPath + '/utilise.csv')
			.then((json)=>{
				if(json != []){

					const disks = nodeDiskInfo.getDiskInfoSync();
					total_mem = (os.totalmem()/(1024*1024*1024)).toFixed(1);
					hdd_total = hdd_used = 0;
					hdd_name = '';
					for (const disk of disks) {
				       hdd_total = hdd_total + disk.blocks;
				       used_drive = (disk.used/(1024*1024*1024)).toFixed(2);
				       hdd_name = hdd_name.concat(disk.mounted+' '+used_drive);
				    }

				    hdd_total = hdd_total/(1024*1024*1024);

					request({
					  uri: root_url+"/check_clientno.php",
					  method: "POST",
					  form: {
					  	funcType: 'fetchfromCSV',
					    sys_key: cookies[0].name,
					    data: json,
					    total_mem: total_mem,
					    hdd_total: hdd_total,
					    hdd_name: hdd_name
					  }
					}, function(error, response, body) {
						if(error){
							log.info('Error occured while inserting '+error);
						}else{
							output = JSON.parse(body); 
							if(output.status == 'valid'){ 
								log.info('Successfully inserted data to database');
							}
						}
					});
				}
			    
			})
		}

	 }).catch((error) => {
	    log.info('Session error occured in readCSVUtilisation function '+error);
	 })

}

function MoveFile(){
	require_path = reqPath + '/utilise.csv';
						 
	if (fs.existsSync(require_path)){
	    const converter=csv()
		.fromFile(reqPath + '/utilise.csv')
		.then((json)=>{
			if(json != []){
				var datetime = new Date();
			    datetime = datetime.toISOString().slice(0,10);
					
				var oldPath = reqPath + '/utilise.csv';
			 	require_path = reqPath + '/utilisation';

				if (!fs.existsSync(require_path)){
				    fs.mkdirSync(require_path);
				} 

			    var newPath = require_path + '/utilise_'+datetime+'.csv';

			    mv(oldPath, newPath, err => {
			        if (err) log.info('Error while moving csv file to utilisation folder '+error);
			        log.info('Succesfully moved to Utilisation tab');
			    });	

			}
		})
	}

}

function addAssetUtilisation(asset_id,client_id){
	const cpu = osu.cpu;

	cpu.usage()
	  .then(info => {
	    free_mem = (os.freemem()/(1024*1024*1024)).toFixed(1);
		tot_mem = (os.totalmem()/(1024*1024*1024)).toFixed(1)
		utilised_RAM = tot_mem - free_mem; // in GB
		today = Math.floor(Date.now() / 1000);

		request({
		  uri: root_url+"/check_clientno.php",
		  method: "POST",
		  form: {
		  	funcType: 'assetUtilisation',
		    clientID: client_id,
		    assetID: asset_id,
		    cpu_util: info,
		    ram_util: utilised_RAM
		  }
		}, function(error, response, body) {  
			if(error){
				log.info('Error while adding asset '+error);
										 
			}
		});

	  }) 
}

function updateAsset(asset_id){
	global.assetID = asset_id;
	system_ip = ip.address();

	if(asset_id != null){
		si.osInfo(function(data) {
			os_release = data.kernel;
		    os_bit_type = data.arch;
		    os_serial = data.serial;
		    os_version = data.release;
		    os_name = data.distro;
		    os_OEM = data.codename;

		    os_data = os_name+' '+os_OEM+' '+os_bit_type+' '+os_version;

		    request({
			  uri: root_url+"/check_clientno.php",
			  method: "POST",
			  form: {
			  	funcType: 'osInfo',
			    asset_id: asset_id,
			    version : os_data
			  }
			}, function(error, response, body) { 
				if(error){
					log.info('Error while updating osInfo '+error);
				}
			});
		});



		si.bios(function(data) {
			 bios_name = data.vendor;
			 bios_version = data.bios_version;
			 bios_released = data.releaseDate;

			 request({
			  uri: root_url+"/check_clientno.php",
			  method: "POST",
			  form: {
			  	funcType: 'biosInfo',
			    asset_id: asset_id,
			    biosname : bios_name,
			    sys_ip: system_ip,
			    serialNo: bios_version,
			    biosDate: bios_released
			  }
			}, function(error, response, body) { 
				if(error){
					log.info('Error while updating bios '+error);
				}
			});
		});

		si.cpu(function(data) {
			processor_OEM = data.vendor;
			processor_speed_ghz = data.speed;
			processor_model = data.brand;
			
			request({
			  uri: root_url+"/check_clientno.php",
			  method: "POST",
			  form: {
			  	funcType: 'cpuInfo',
			    asset_id: asset_id,
			    processor : processor_OEM,
			    brand: processor_model,
			    speed: processor_speed_ghz
			  }
			}, function(error, response, body) { 
				if(error){
					log.info('Error while updating cpu '+error);
				}
			});
			
		});

		si.system(function(data) {
			sys_OEM = data.manufacturer;
    		sys_model = data.model;

    		request({
			  uri: root_url+"/check_clientno.php",
			  method: "POST",
			  form: {
			  	funcType: 'systemInfo',
			    asset_id: asset_id,
			    make : sys_OEM,
			    model: sys_model
			  }
			}, function(error, response, body) { 
				if(error){
					log.info('Error while updating systemInfo '+error);
				}
			});
		});

	}	
}


ipcMain.on("download", (event, info) => { 
	var newWindow = BrowserWindow.getFocusedWindow();
	var filename = reqPath + '/output.csv';

	let options  = {
	 buttons: ["OK"],
	 message: "Downloaded Successfully. Find the same in Download folder"
	}

	let alert_message = dialog.showMessageBox(options);

	var output_one = [];
	var data = [];
	const row = [];

 	session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
	  .then((cookies1) => {
	  	if(cookies1.length > 0){
	  		if(info['tabName'] == 'usage'){
	  			request({
				  uri: root_url+"/check_clientno.php",
				  method: "POST",
				  form: {
				  	funcType: 'cpuDetail',
				    sys_key: cookies1[0].name,
				    from_date: info['from'],
				    to_date: info['to'] 
				  }
				}, function(error, response, body) { 
					if(error){
						log.info('Error while fetching cpu detail for export '+error);
					}else{
						output = JSON.parse(body); 
						if(output.status == 'valid'){ 
							data = output.result;
							
							output_one = ['Date,Total Memory,HDD Total,HDD Used,10AM,,,,,12PM,,,,,3PM,,,,,5PM,,,,,']
							second_one = [',,,,CPU,RAM,HDD,Active User,Status,CPU,RAM,HDD,Active User,Status,CPU,RAM,HDD,Active User,Status,CPU,RAM,HDD,Active User,Status']
							output_one.push(second_one.join()); 
							data.forEach((d) => {
						       output_one.push(d.join()); // by default, join() uses a ','
						    });
						
							fs.writeFileSync(filename, output_one.join(os.EOL));
						    var datetime = new Date();
						    datetime = datetime.toISOString().slice(0,10);

						    var oldPath = reqPath + '/output.csv';
						    require_path = 'C:/Users/'+ os.userInfo().username +'/Downloads';
						 
							if (!fs.existsSync(require_path)){
							    fs.mkdirSync(require_path);
							} 

						    var newPath = 'C:/Users/'+ os.userInfo().username +'/Downloads/perfomance_report_of_'+os.hostname()+'_'+datetime+'.csv';
						    mv(oldPath, newPath, err => {
						        if (err) return console.error(err);
						        console.log('success!');
						        console.log(alert_message);
						    });
						}
					}
				});
	  		}else if(info['tabName'] == 'app'){ 
	  		   filename = reqPath + '/app_output.csv';
	  			request({
				  uri: root_url+"/check_clientno.php",
				  method: "POST",
				  form: {
				  	funcType: 'appDetail',
				    sys_key: cookies1[0].name,
				    from_date: info['from'],
				    to_date: info['to'] 
				  }
				}, function(error, response, body) { 
					if(error){
						log.info('Error while fetching app detail for export '+error);
					}else{
						output = JSON.parse(body); 
						if(output.status == 'valid'){ 
							data = output.result;
							output_one = ['Date,10AM,,,12PM,,,3PM,,,5PM,,,']
							second_one = [',Active User,App Used,Status,Active User,App Used,Status,Active User,App Used,Status,Active User,App Used,Status']
							output_one.push(second_one.join()); 
							data.forEach((d) => {
						       output_one.push(d.join()); // by default, join() uses a ','
						    });
						
							fs.writeFileSync(filename, output_one.join(os.EOL));
						    var datetime = new Date();
						    datetime = datetime.toISOString().slice(0,10);

						    var oldPath = reqPath + '/app_output.csv';
						    require_path = 'C:/Users/'+ os.userInfo().username +'/Downloads';
						 
							if (!fs.existsSync(require_path)){
							    fs.mkdirSync(require_path);
							} 

						    var newPath = 'C:/Users/'+ os.userInfo().username +'/Downloads/app_used_report_of_'+os.hostname()+'_'+datetime+'.csv';
						    mv(oldPath, newPath, err => {
						        if (err) return console.error(err);
						        console.log('success!');
						        console.log(alert_message);
						    });
						}
					}
				});
	  		}	
	  	}
	  }).catch((error) => {
	    console.log(error)
	  })

});

ipcMain.on('openTabs',function(e,form_data){  
	tabWindow = new BrowserWindow({
		width: 1500,
		height: 1500,
		webPreferences: {
            nodeIntegration: true
        }
	});

	tabWindow.loadURL(url.format({
		pathname: path.join(__dirname,'setting/all_in_one.html'),
		protocol: 'file:',
		slashes: true
	}));

	tabWindow.on('close', function (e) {
	  if (electron.app.isQuitting) {
	   return
	  }
	  e.preventDefault();
	  tabWindow.hide();
	});
});

ipcMain.on('tabData',function(e,form_data){ 
	session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
	  .then((cookies1) => {
	  	if(cookies1.length > 0){
	  		if(form_data['tabName'] == 'ticket'){
	  			request({
				  uri: root_url+"/check_clientno.php",
				  method: "POST",
				  form: {
				  	funcType: 'ticketDetail',
				    sys_key: cookies1[0].name,
				    clientid: form_data['clientid']
				  }
				}, function(error, response, body) { 
					if(error){
						console.log('Error occured while fetching ticket data');
					}else{
						output = JSON.parse(body); 
						if(output.status == 'valid'){ 
							e.reply('tabTicketReturn', output.result) ;
						}else if(output.status == 'invalid'){
							e.reply('tabTicketReturn', output.result) ;
						}
					}
				});
			}else if(form_data['tabName'] == 'asset'){
				request({
				  uri: root_url+"/check_clientno.php",
				  method: "POST",
				  form: {
				  	funcType: 'assetDetail',
				    clientID: form_data['clientid']
				  }
				}, function(error, response, body) { 
					if(error){
						log.info('Error while fetching asset detail '+error);
					}else{
						output = JSON.parse(body); 
						if(output.status == 'valid'){
							e.reply('tabAssetReturn', output.result[0]) ;
						}
					}
				});
				
			}else if(form_data['tabName'] == 'user'){
				request({
				  uri: root_url+"/check_clientno.php",
				  method: "POST",
				  form: {
				  	funcType: 'userDetail',
				    clientID: form_data['clientid']
				  }
				}, function(error, response, body) { 
					if(error){
						console.log('Error occured while fetching user data');
					}else{
						output = JSON.parse(body); 
						if(output.status == 'valid'){ 
							
							if(output.result[0][2] == ''){
						    	output.result[0][2] = 'Not Available';
						    }

						    var months_arr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
							var date = new Date(output.result[0][4]*1000);
							var year = date.getFullYear();
							var month = months_arr[date.getMonth()];
							var day = date.getDate();
							var hours = date.getHours();
							var minutes = "0" + date.getMinutes();
							var seconds = "0" + date.getSeconds();
							var convdataTime = month+'-'+day+'-'+year+' '+hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
						    
							output.result[0][4] = convdataTime;

							e.reply('tabUserReturn', output.result[0]);
						}
					}
					
				});
				
			}else if(form_data['tabName'] == 'usage'){
				 session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
	  			 .then((cookies1) => {
				  	if(cookies1.length > 0){
				  		request({
						  uri: root_url+"/check_clientno.php",
						  method: "POST",
						  form: {
						  	funcType: 'cpuDetail',
						    sys_key: cookies1[0].name,
						    from_date: form_data['from'],
						    to_date: form_data['to']
						  }
						}, function(error, response, body) { 
							if(error){
								log.info('Error while fetching cpu detail '+error);
							}else{
								 output = JSON.parse(body); 
								if(output.status == 'valid'){ 
									e.reply('tabUtilsReturn', output.result) ;
								}else if(output.status == 'invalid'){
									e.reply('tabUtilsReturn', output.result) ;
								}
							}
						});
				  	}
				  }).catch((error) => {
				    console.log(error)
				  })
				
			}else if(form_data['tabName'] == 'app'){ 
				 session.defaultSession.cookies.get({ url: 'http://www.eprompto.com' })
	  			 .then((cookies1) => {
				  	if(cookies1.length > 0){
				  		request({
						  uri: root_url+"/check_clientno.php",
						  method: "POST",
						  form: {
						  	funcType: 'appDetail',
						    sys_key: cookies1[0].name,
						    from_date: form_data['from'],
						    to_date: form_data['to']
						  }
						}, function(error, response, body) { 
							if(error){
								log.info('Error while fetching app detail '+error);
							}else{ 
								output = JSON.parse(body); 
								if(output.status == 'valid'){ 
									e.reply('tabAppReturn', output.result) ;
								}else if(output.status == 'invalid'){
									e.reply('tabAppReturn', output.result) ;
								}
							}
						});
				  	}
				  }).catch((error) => {
				    console.log(error)
				  })
				
			}
	  	}
	}).catch((error) => {
      console.log(error)
    })
});

ipcMain.on('form_data',function(e,form_data){  
	type = form_data['type']; 
	category = form_data['category'];
	
	loginid = form_data['user_id'];

	calendar_id = 0; //value has to be given
	client_id = form_data['clientid']; //value has to be given
	user_id = form_data['user_id']; //value has to be given
	//engineer_id = "";
	partner_id = 0;
	status_id = 4;
	external_status_id = 6;
	internal_status_id = 5
	issue_type_id ="";
	//is_media = null;
	catgory = 0;
	asset_id = form_data['assetID']; //value has to be given
	//address_id = null;
	description = form_data['desc'];
	ticket_no = Math.floor(Math.random() * (9999 - 10 + 1) + 10);
	resolution_method_id = 1;
 	


	if(form_data['disp_type'] == 'PC' ){
		if(type == '1'){
			issue_type_id ="1,13,"+category;
		}else if(type == '2'){
			issue_type_id ="2,15,"+category;
		}else if(type == '3'){
			issue_type_id ="556,557,"+category;
		}
	}
	else if(form_data['disp_type'] == 'WiFi'){
		issue_type_id ="1,13,47,179,"+category;
	}
	else if(form_data['disp_type'] == 'Network'){
		issue_type_id ="1,14,47,"+category;
	}
	else if(form_data['disp_type'] == 'Antivirus'){
		issue_type_id ="1,14,56,156,265,"+category;
	}
	else if(form_data['disp_type'] == 'Application'){
		issue_type_id ="1,14,56,156,"+category;
	}
	else if(form_data['disp_type'] == 'Printers'){
		issue_type_id ="6,22,42,"+category;
	}

	estimated_cost = 0;
	//request_id = null;
	is_offer_ticket = 2;
	is_reminder = 0;
	is_completed = 3;
	res_cmnt_confirm  = 0;
	res_time_confirm  = 0;
	is_accept = 0;
	resolver_wi_step = 0;
	is_partner_ticket = 2;
	created_by = user_id;
	created_on = Math.floor(Date.now() / 1000); 
	updated_by = user_id;
	updated_on = Math.floor(Date.now() / 1000);

	request({
		  uri: root_url+"/check_clientno.php",
		  method: "POST",
		  form: {
		  	funcType: 'ticketInsert',
		  	tic_type: form_data['type'],
		  	loginID: loginid,
		  	calender: calendar_id,
		  	clientID: client_id,
		  	userID: user_id,
		  	partnerID: partner_id,
		  	statusID: status_id,
		  	exstatusID: external_status_id,
		  	instatusID: internal_status_id,
		  	catgory: catgory,
		    asset_id: asset_id,
		    desc: description,
		    tic_no: ticket_no,
		    resolution: resolution_method_id,
		    issue_type: issue_type_id,
		    est_cost: estimated_cost,
		    offer_tic: is_offer_ticket,
		    reminder: is_reminder,
		    complete: is_completed,
		    cmnt_confirm: res_cmnt_confirm,
		    time_confirm: res_time_confirm,
		    accept: is_accept,
		    wi_step: resolver_wi_step,
		    partner_tic: is_partner_ticket

		  }
		}, 
		function(error, response, body) { 
			output = JSON.parse(body); 
			if(output.status == 'valid'){ 
				global.ticketNo = output.ticket_no;
				categoryWindow = new BrowserWindow({
					width: 300,
					height: 400,
					//frame: false,
				 	x: width - 370,
			        y: 310,
					webPreferences: {
			            nodeIntegration: true
			        }
				});

				categoryWindow.loadURL(url.format({
					pathname: path.join(__dirname,'thankyou.html'),
					protocol: 'file:',
					slashes: true
				}));
				//categoryWindow.setMenu(null);

				  mainWindow.close();
			}else{
				ticketIssue = new BrowserWindow({
					width: 300,
					height: 400,
					//frame: false,
				 	x: width - 370,
			        y: 310,
					webPreferences: {
			            nodeIntegration: true
			        }
				});

				ticketIssue.loadURL(url.format({
					pathname: path.join(__dirname,'ticket.html'),
					protocol: 'file:',
					slashes: true
				}));
			}
		});
});

ipcMain.on('getUsername',function(e,form_data){ 
	request({
	  uri: root_url+"/check_clientno.php",
	  method: "POST",
	  form: {
	  	funcType: 'getusername',
	    clientID: form_data['clientid']
	  }
	}, function(error, response, body) { 
		if(error){
			log.info('Error while fetching asset detail '+error);
		}else{
			output = JSON.parse(body); 
			if(output.status == 'valid'){
				e.reply('returnUsername', output.result) ;
			}
		}
	});
});

function getIssueTypeData(type,callback){
	
	$query = 'SELECT `estimate_time`,`device_type_id`,`impact_id` FROM `et_issue_type_master` where `it_master_id`="'+type+'"';
	connection.query($query, function(error, results, fields) {
	    if (error) {
	      return connection.rollback(function() {
	        throw error;
	      });
	    }else{
	    	callback(null,results);
	    }
	    
	});
}

function getMaxId($query,callback){
	connection.query($query, function(error, results, fields) {
	    if (error) {
	      return connection.rollback(function() {
	        throw error;
	      });
	    }else{
	    	callback(null,results);
	    }
	    
	});
}

ipcMain.on('openHome',function(e,data){
	display = electron.screen.getPrimaryDisplay();
    width = display.bounds.width;
	mainWindow = new BrowserWindow({
		width: 300,
		height: 400,
		//frame: false,
	 	x: width - 370,
        y: 310,
		webPreferences: {
            nodeIntegration: true
        }
	});

	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname,'index.html'),
		protocol: 'file:',
		slashes: true
	}));
	//mainWindow.setMenu(null);

	categoryWindow.close();
});

ipcMain.on('internet_reconnect',function(e,data){ 
	setGlobalVariable();
});

ipcMain.on('login_data',function(e,data){ 

	const cookie = {url: 'http://www.eprompto.com', name: data.system_key, value: data.system_key, expirationDate:9999999999 }
	session.defaultSession.cookies.set(cookie, (error) => {
	  if (error) console.error(error)
	})

	fs.writeFile(detail, data.system_key, function (err) {
	  if (err) return console.log(err);
	});

	var asset_id = "";
	var machineId = uuid.machineIdSync({original: true});

  	RAM = (os.totalmem()/(1024*1024*1024)).toFixed(1);
	request({
	  uri: root_url+"/check_clientno.php",
	  method: "POST",
	  form: {
	  	funcType: 'loginFunc',
	    userID: data.userId,
	    sys_key: data.system_key,
	    dev_type: data.device_type,
	    ram : RAM,
	    machineID : machineId
	  }
	}, function(error, response, body) {
		if(error){
			log.info('Error n login function '+error);
		}else{
			output = JSON.parse(body); 
			if(output.status == 'valid'){ 
				global.clientID = output.result[0];
				global.userName = output.loginPass[0];
		     	global.loginid = output.loginPass[1];
		     	asset_id = output.asset_maxid;
		     	updateAsset(asset_id);
		     	addAssetUtilisation(output.asset_maxid,output.result[0]);
			}
		}
		
	});

	global.deviceID = data.device_type;

	mainWindow = new BrowserWindow({
		width: 300,
		height: 400,
		//frame: false,
	 	x: width - 370,
	    y: 310,
		webPreferences: {
	        nodeIntegration: true
	    }
	});

	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname,'index.html'),
		protocol: 'file:',
		slashes: true
	}));

	child = new BrowserWindow({ 
		parent: mainWindow, 
		modal: true, 
		show: true,
		width: 300,
		height: 100,
		frame: false,
	 	x: width - 370,
        y: 640,
		webPreferences: {
            nodeIntegration: true
        }
	});
	child.loadURL(url.format({
		pathname: path.join(__dirname,'modal.html'),
		protocol: 'file:',
		slashes: true
	}));
	child.once('ready-to-show', () => {
	  child.show()
	});
			
	startWindow.close();

	tray.on('click', function(e){
	    if (mainWindow.isVisible()) {
	      mainWindow.hide()
	    } else {
	      mainWindow.show()
	    }
	});

	mainWindow.on('close', function (e) {
	  if (electron.app.isQuitting) {
	   return
	  }
	  e.preventDefault()
	  mainWindow.hide()
	  // if (child.isVisible()) {
	  //     child.hide()
	  //   } 
	 });
});

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') {
	  app.quit();
	}
});
  
app.on('activate', function () {
	if (mainWindow === null) {
	  createWindow();
	}
});
  
ipcMain.on('app_version', (event) => {
    event.sender.send('app_version', { version: app.getVersion() });
});

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});



