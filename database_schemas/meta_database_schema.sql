# schema of the meta database, which enriches the logged data with other information

CREATE TABLE IF NOT EXISTS wifi_location(
  _id INT PRIMARY KEY AUTO_INCREMENT,
  device_id VARCHAR(150) NOT NULL,
  wifi_ssid TEXT NOT NULL,
  location ENUM('home','work')
);

CREATE TABLE IF NOT EXISTS study_participants(
  _id INT PRIMARY KEY AUTO_INCREMENT,
  device_id VARCHAR(150) NOT NULL,
  participant_id INT NOT NULL,
  password VARCHAR(150) NOT NULL,
  rescuetime_api_key TEXT NULL DEFAULT NULL,
  study_join DATETIME NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id)
);

CREATE TABLE IF NOT EXISTS notes(
  _id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  visualization ENUM('TIMELINE','TIMESEGMENT') NOT NULL,
  participant_id INT NOT NULL REFERENCES study_participants(participant_id),
  note_text TEXT NOT NULL,
  timeline_config TEXT NOT NULL,
  creation_time DATETIME NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_configs (
  _id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  participant_id INT NOT NULL REFERENCES study_participants(participant_id),
  config_key VARCHAR(255) NOT NULL,
  config_object TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  UNIQUE(participant_id, config_key)
);

CREATE TABLE  nl_correlations (
  _id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  participant_id INT NOT NULL REFERENCES study_participants(participant_id),
  feature_one VARCHAR(255) NOT NULL,
  feature_two VARCHAR(255) NOT NULL,
  domain_one VARCHAR(255) NOT NULL,
  domain_two VARCHAR(255) NOT NULL,
  `from` BIGINT NOT NULL,
  `to` BIGINT NOT NULL,
  p_value FLOAT NOT NULL,
  correlation_coefficient FLOAT NOT NULL,
  sentence TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id, feature_one, feature_two, `from`, `to`)
);

CREATE TABLE nl_correlations_hide_rules (
  _id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  participant_id INT NOT NULL REFERENCES study_participants(participant_id),
  correlation_id INT NULL DEFAULT NULL REFERENCES nl_correlations(_id),
  feature VARCHAR(255) NULL DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  UNIQUE(participant_id,correlation_id),
  UNIQUE(participant_id,feature)
);