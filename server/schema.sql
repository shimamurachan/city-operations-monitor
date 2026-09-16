CREATE TABLE IF NOT EXISTS daily_operations (
  date TEXT NOT NULL,
  city TEXT NOT NULL,
  total_orders INTEGER NOT NULL,
  completed_orders INTEGER NOT NULL,
  cancelled_orders INTEGER NOT NULL,
  gmv_sar REAL NOT NULL,
  subsidy_sar REAL NOT NULL,
  completion_rate_pct REAL NOT NULL,
  subsidy_rate_pct REAL NOT NULL,
  avg_delivery_time_min REAL NOT NULL,
  active_riders INTEGER NOT NULL,
  new_users INTEGER NOT NULL,
  avg_rating REAL NOT NULL,
  PRIMARY KEY (date, city)
);

CREATE TABLE IF NOT EXISTS subsidy_dimensions (
  date TEXT NOT NULL,
  subsidy_type TEXT NOT NULL,
  user_type TEXT NOT NULL,
  category TEXT NOT NULL,
  subsidy_total_sar REAL NOT NULL,
  subsidized_orders INTEGER NOT NULL,
  completed_orders INTEGER NOT NULL,
  related_gmv_sar REAL NOT NULL,
  avg_subsidy_sar REAL NOT NULL,
  subsidy_gmv_ratio REAL NOT NULL,
  PRIMARY KEY (date, subsidy_type, user_type, category)
);

CREATE TABLE IF NOT EXISTS channel_retention (
  registration_channel TEXT PRIMARY KEY,
  active_users INTEGER NOT NULL,
  repeat_users INTEGER NOT NULL,
  avg_orders_14d REAL NOT NULL,
  avg_spend_14d_sar REAL NOT NULL,
  avg_subsidy_14d_sar REAL NOT NULL,
  cac_sar REAL NOT NULL,
  first_order_subsidy_rate REAL NOT NULL,
  repeat_rate REAL NOT NULL,
  ltv_cac REAL NOT NULL,
  rating TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_operations_city_date ON daily_operations(city, date);
CREATE INDEX IF NOT EXISTS idx_subsidy_dimensions_date ON subsidy_dimensions(date);
CREATE INDEX IF NOT EXISTS idx_subsidy_dimensions_filters ON subsidy_dimensions(subsidy_type, user_type, category);
