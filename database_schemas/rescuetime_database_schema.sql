# to be executed in the aware study database

CREATE TABLE IF NOT EXISTS rescuetime_usage_log (
  _id              BIGINT       NOT NULL PRIMARY KEY AUTO_INCREMENT,
  apikey_hash      VARCHAR(255) NOT NULL,
  timestamp        LONG         NOT NULL,
  `date`           DATETIME     NULL                 DEFAULT NULL,
  time_spent_secs  INT          NULL                 DEFAULT NULL,
  number_of_people INT          NULL                 DEFAULT NULL,
  activity         VARCHAR(255) NULL                 DEFAULT NULL,
  category         TEXT         NULL                 DEFAULT NULL,
  productivity     INT          NULL                 DEFAULT NULL,
  UNIQUE(apikey_hash, date, activity)
);

