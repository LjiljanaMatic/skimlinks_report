var cache = CacheService.getPublicCache();
var script_properties = PropertiesService.getScriptProperties();
var triggers = ScriptApp.getProjectTriggers();

/**
 * Imports Skimlinks .csv file and caches result
 * This function will run at 6AM Eastern Time
 * @return {Array} csv_content - two dimensional array of data
 **/

function importDataFromCSV() {

    //clear all every minutes triggeres from previous script run
  for ( var i in triggers ) {
    var funcName = triggers[i].getHandlerFunction();
    if(funcName === "importDataFromCSV") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  var date = new Date(new Date().setDate(new Date().getDate() - 4)),
      dd    = date.getDate(),
      mm    = date.getMonth() + 1,
      yyyy  = date.getFullYear();

  var formated_date = yyyy + "-" + mm + "-" + dd;

  var result = UrlFetchApp.fetch("https://api-reports-beta.skimlinks.com/data-export/v1/1524629/page/P7D/" + formated_date + ".csv?key=c541a2da7066a7e04cb3d6e68f98681d").getContentText();
  parseCsvResponse(result);
}

/**
 * Prepares all the data neccessary for Skimlinks Dynamic Dashboard
 * and inserts data in Google Sheets
 * This function will run at 7AM Eastern Time
 **/

function prepareDashboardData() {

  //clear all every minutes triggeres from previous script run
  for ( var i in triggers ) {
    var funcName = triggers[i].getHandlerFunction();
    if(funcName === "prepareDashboardData") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  var data = [];
  var csv_length = script_properties.getProperty("csv_content_length");
  var start_time = (new Date()).getTime();
  var data_row = script_properties.getProperty('data_row');
  var buzz_ids = JSON.parse(script_properties.getProperty('buzz_ids'));
  
  if(buzz_ids === null) {
    buzz_ids = [];
  }

  for(var i = (data_row !== null ? Math.round(data_row) : 1); i < csv_length; i++){
    var data = JSON.parse(cache.get("csv_content_" + i));
    var current_time = (new Date()).getTime();

    if(current_time - start_time >= 240000) {
      script_properties.setProperty("data_row", i);
      script_properties.setProperty("buzz_ids", JSON.stringify(buzz_ids));
      ScriptApp.newTrigger("prepareDashboardData")
               .timeBased()
               .everyMinutes(1)
               .create();
      break;
    } else if (data[0] && /buzzfeed.com/.test(data[0])) {
      var html = UrlFetchApp.fetch(data[0]).getContentText();
      var buzz_id = getBuzzId(html);
        
      if(/^\d+$/.test(buzz_id)){
        var buzz_object = getBuzzObject(buzz_id);
  
        if(isPublishedInPast60Days(buzz_object.buzz.published)){
          var social_lift = getViralLift(html);
          var dashboard_data = [
            data[0],                          // Post URL
            buzz_object.buzz.published_date,  // Publication Date
            buzz_object.buzz.username,        // Author
            data[2],                          // Total Clicks
            data[3],                          // Total Order
            data[4],                          // Total Order Value
            data[10],                         // Total Earnings
            buzz_object.buzz.impressions,     // Total Views
            social_lift                       // Social Lift
          ];
          cache.put(buzz_id, JSON.stringify(dashboard_data), 10800);
          buzz_ids.push(buzz_id);
        }
      }
    }
  }
  //insert data when for loop is finished
  if(i == csv_length) {
    insertDatainSheet(buzz_ids);
  }
}

/**
 * Gets Buzz object via Buzz API
 * @param {String} buzz - buzz id; Required
 * @return {String} result - parsed buzz object
 **/

function getBuzzObject(buzz){
  var jsonData = UrlFetchApp.fetch("http://www.buzzfeed.com/api/v2/buzz/" + buzz).getContentText();
  var result = JSON.parse(jsonData);

  return result;
}

/**
 * Gets buzz id from HTML
 * @param {String} html - html information; Required
 * @return {String} chopped - buzz id
 **/

function getBuzzId(html) {
  var find = 'bf:buzzid" content="';
  var find_end = '" />';
  var first_chop = html.substring(html.lastIndexOf(find) + find.length);
  var chopped = first_chop.substring(0, first_chop.indexOf(find_end));

  return chopped;
}

/**
 * Gets viral lift from HTML
 * @param {String} html - html information; Required
 * @return {Number} post_lift - viral lift
 **/

function getViralLift(html) {
  var find = 'viral_lift":"';
  var find_end = '","';
  var first_chop = html.substring(html.lastIndexOf(find) + find.length);
  var chopped = first_chop.substring(0, first_chop.indexOf(find_end));
  var post_lift = parseFloat(chopped);

  if (isNaN(post_lift)) { 
    return "N/A"; 
  } else { 
    return post_lift; 
  }
}

/**
 * Uses timestamp that represents published date and checks if it is published in 60 days from today. If it is it will return published date object
 * @param {Date} unix_timestamp - Unix timestamp of published date; Required
 * @return {Boolean} true OR false
 **/

function isPublishedInPast60Days(unix_timestamp) {
  var days_prior_today = new Date(new Date().setDate(new Date().getDate()-60));

  if(days_prior_today.getTime() <= (unix_timestamp*1000)) {
    return true;
  } else {
    return false;
  }
}

/**
 * Parses a delimited string into an two dimensional array
 * @param {String} csv_string - csv string got from external URL; Required
 * @return {Array} return_array - two dimensional array
 **/

function parseCsvResponse(csv_string) {
  var return_array = [];
  var str_lines = csv_string.split(/\n|\r/g);
  var start_time = (new Date()).getTime();
  var ii = script_properties.getProperty('csv_string_row');
  var csv_content_length = script_properties.getProperty("csv_content_length");

  if (ii !== null) {
    ii = Math.round(ii);
    csv_content_length = Math.round(csv_content_length);
  } else {
    ii = 0, csv_content_length = 0;
  }

  // changed var max = str_lines.length to var max = 2000
  for (var max = 1000; ii <= max; ii++) {
    var current_time = (new Date()).getTime();
    if(current_time - start_time >= 240000) {
      script_properties.setProperty("csv_string_row", ii);
      ScriptApp.newTrigger("importDataFromCSV")
               .timeBased()
               .everyMinutes(5)
               .create();
      break;
    } else {
      var line = str_lines[ii];
      if (line != '' && line !== undefined) {
          return_array.push(line.replace(/"/g, "").split(/,/));
          // cache each row for 180 minutes
          csv_content_length++;
          cache.put("csv_content_" + ii, JSON.stringify(return_array[ii]), 10800);
      }
    }
  }
  script_properties.setProperty("csv_content_length", csv_content_length);
}

/**
 * Gets two dimensional array and inserts it into Google Sheet
 * @param {Array} data - buzz ids array; Required 
 **/

function insertDatainSheet(data_ids) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var delete_old_record = ss.getSheetByName('Sheet1');
  var result = [];

  delete_old_record.clearContents();

  result.push(["Post URL", "Publication Date", "Author", "Total Clicks", "Total Orders", "Total Order Value", "Total Earnings", "Total Views", "Social Lift"]);

  for(var j = 0; j < data_ids.length; j++) {
    var data = JSON.parse(cache.get(data_ids[j]));
    result.push(data);
  }

  for (var i = 0, max = result.length; i < max; i++ ) {
    sheet.getRange(i+1, 1, 1, result[i].length).setValues(new Array(result[i]));
  }  
}