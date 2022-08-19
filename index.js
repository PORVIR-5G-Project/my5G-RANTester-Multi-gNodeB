// Required packages
const fs = require("fs");
const net = require("net");
const path = require("path");
const yaml = require("yaml");

// Get environment variables
const NUM_UE = parseInt(process.env.NUM_UE ?? 30);
const NUM_GNB = parseInt(process.env.NUM_GNB ?? 3);
const CONFIG_FILE = process.env.CONFIG_FILE ?? "tester.yaml";

// Docker compose files
const ORIG_COMPOSE_NAME = "docker-compose.yaml";
const NEW_COMPOSE_NAME = "docker-multi.yaml";

// Parse settings YAML file
const tester_config_raw = fs.readFileSync("./config/" + CONFIG_FILE, "utf8");
const tester_config = yaml.parse(tester_config_raw);

// Parse compose YAML file
const docker_compose_raw = fs.readFileSync(ORIG_COMPOSE_NAME, "utf8");
const docker_compose = yaml.parse(docker_compose_raw);
const tester_service = JSON.parse(JSON.stringify(docker_compose.services.my5grantester));

// Remove the original tester service, but keep other services
delete docker_compose.services.my5grantester;

// Get the initial gNB ID
const gnbid_str = tester_config.gnodeb.plmnlist.gnbid;
const gnbid_len = gnbid_str.length;
const gnbid = parseInt(gnbid_str);

// Get the initial UE MSIN
const msin_str = tester_config.ue.msin;
const msin_len = msin_str.length;
const msin = parseInt(msin_str);

// Get filename info
const filename_base = path.parse(CONFIG_FILE).name;
const filename_ext = path.parse(CONFIG_FILE).ext;

// Generate config files
const num_ue_per_gnb = Math.floor(NUM_UE / NUM_GNB);
for (let idx = 0; idx < NUM_GNB; idx++) {
  const tester_ip = generateConfig(idx);
  generateComposeService(idx, tester_ip);
}

// Write new Docker compose file
const new_compose_data = yaml.stringify(docker_compose);
fs.writeFileSync(NEW_COMPOSE_NAME, new_compose_data);

/*****************/
/* Other Methods */
/*****************/

// Method to generate the config file for a specific index
function generateConfig(idx) {
  let config = JSON.parse(JSON.stringify(tester_config)); // Clone initial config

  // Change gnbid and initial msin
  config.gnodeb.plmnlist.gnbid = String(gnbid + idx).padStart(gnbid_len, "0");
  config.ue.msin = String(msin + idx * num_ue_per_gnb).padStart(msin_len, "0");

  // Check if it's a valid IPv4 or a hostname
  let tester_ip = config.gnodeb.controlif.ip;
  if (net.isIP(tester_ip) == 4) {
    const ip_split = tester_ip.split(".");
    // IP address: XXX.YYY.ZZZ.50+
    tester_ip = `${ip_split[0]}.${ip_split[1]}.${ip_split[2]}.${50 + idx}`;
  } else {
    const ip_split = tester_ip.split(".");
    // Hostname: xxx0+.yyy.zzz
    tester_ip = `${ip_split[0] + idx}.${ip_split.slice(1).join(".")}`;
  }

  // Change IP/Hostname
  config.gnodeb.controlif.ip = tester_ip;
  config.gnodeb.dataif.ip = tester_ip;

  // Save new file
  const cfg_data = yaml.stringify(config);
  const file_path = "./config/" + filename_base + idx + filename_ext;
  fs.writeFileSync(file_path, cfg_data);

  return tester_ip;
}

// Method to generate a service for the Docker compose
function generateComposeService(idx, tester_ip) {
  // Clone initial config
  const new_service = JSON.parse(JSON.stringify(tester_service));
  // Append the index to the container name
  new_service.container_name += idx;

  // Add the new tester IP/Hoestname
  if (new_service.networks?.default?.ipv4_address) {
    new_service.networks.default.ipv4_address = tester_ip;
  } else if (new_service.networks?.default?.aliases) {
    new_service.networks.default.aliases[0] = tester_ip;
  }

  // Change config file (volume)
  const volume = new_service.volumes[0].split(":");
  const vol_path = path.parse(volume[0]);
  const new_vol = vol_path.dir + "/" + vol_path.name + idx + vol_path.ext + ":" + volume[1];
  new_service.volumes[0] = new_vol;

  // Add this service to the docker compose object
  docker_compose.services[new_service.container_name] = new_service;
}
