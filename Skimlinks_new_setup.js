var cache = CacheService.getPublicCache();
var script_properties = PropertiesService.getScriptProperties();
var triggers = ScriptApp.getProjectTriggers();

function importDataFromCSV() {

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

  for (var max = str_lines.length; ii < max; ii++) {
    var current_time = (new Date()).getTime();
    if(current_time - start_time >= 240000) {
      script_properties.setProperty("csv_string_row", ii);
      ScriptApp.newTrigger("importDataFromCSV")
               .timeBased()
               .everyMinutes(1)
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
      if(ii === max){
        insertDatainSheet();
      }
    }
  }
  script_properties.setProperty("csv_content_length", csv_content_length);
}

function insertDatainSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var csv_length = script_properties.getProperty("csv_content_length");
  var result = [];

  for(var j = 0; j < csv_length; j++) {
    var data = JSON.parse(cache.get("csv_content_" + i));
    result.push(data);
  }

  for (var i = 0, max = result.length; i < max; i++ ) {
    sheet.getRange(i+1, 1, 1, result[i].length).setValues(new Array(result[i]));
  }  
}