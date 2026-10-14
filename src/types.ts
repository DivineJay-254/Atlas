export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  commanderTitle?: string;
  toolCalls?: ToolExecutionResult[];
  modelUsed?: string;
  isAudioPlaying?: boolean;
}

export interface ToolExecutionResult {
  name: string;
  args: any;
  result: any;
}

export interface SystemSpecs {
  os: string;
  processor: string;
  cpu: {
    usage_percent: number;
    cores_logical: number;
    cores_physical: number;
    frequency_mhz: number | string;
  };
  memory: {
    total_gb: number;
    used_gb: number;
    usage_percent: number;
  };
  disk: {
    mount: string;
    total_gb: number;
    free_gb: number;
    usage_percent: number;
  };
  battery: {
    present: boolean;
    percent: number;
    power_plugged: boolean;
  };
  boot_time: string;
}

export interface WeatherData {
  city: string;
  country?: string;
  temp: number;
  feels_like: number;
  condition: string;
  description?: string;
  humidity: number;
  wind_speed: number;
  forecast?: Array<{
    day: string;
    temp: number;
    condition: string;
  }>;
}
