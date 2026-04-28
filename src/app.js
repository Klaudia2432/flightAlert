let pageHeader = document.getElementById("page-header");

let boeingModels = [
    "Boeing 737",
    "Boeing 757"
];

let airbusModels = [
    "Airbus 319", 
    "Airbus 320", 
    "Airbus 321"
];

let airlines = [
    "Wizzair",
    "Ryanair",
    "British Airways",
    "EasyJet",
    "United"
];

let glasgowAirport = {
    "name" : "Glasgow",
    "code" : "GLA"
}

let edinburghAirport = {
    "name" : "Edinburgh",
    "code" : "EDI"
}

alert(airlines[3] + " " + airbusModels[2]);
alert("Altitude 3500 ft");
pageHeader.innerText = "5 minutes until " + airlines[3] + " " + airbusModels[2] + 
" from " + glasgowAirport.code + " to " + edinburghAirport.code + " is flying above your house.";
