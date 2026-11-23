import type { Department, Equipment, Lab, Persona } from '@lablink/shared';

/**
 * Reference data for the demo campus. In production this would be maintained
 * by lab administrators; it is static here because it changes rarely and the
 * interesting, mutable state (bookings) lives in the booking repository.
 */

export const departments: Department[] = [
  { id: 'ece', code: 'ECE', name: 'Electronics & Communication' },
  { id: 'cse', code: 'CSE', name: 'Computer Science' },
  { id: 'mech', code: 'MECH', name: 'Mechanical Engineering' },
  { id: 'bio', code: 'BIO', name: 'Biotechnology' },
  { id: 'des', code: 'DES', name: 'Design & Innovation' },
];

export const labs: Lab[] = [
  {
    id: 'ece-adv',
    name: 'Advanced Electronics Lab',
    departmentId: 'ece',
    location: 'ECE Block, Room 204',
    openHour: 9,
    closeHour: 18,
  },
  {
    id: 'ece-emb',
    name: 'Embedded Systems Lab',
    departmentId: 'ece',
    location: 'ECE Block, Room 310',
    openHour: 9,
    closeHour: 20,
  },
  {
    id: 'cse-ai',
    name: 'AI & High-Performance Computing Lab',
    departmentId: 'cse',
    location: 'CSE Block, Room 101',
    openHour: 8,
    closeHour: 22,
  },
  {
    id: 'mech-fab',
    name: 'Fabrication & Prototyping Lab',
    departmentId: 'mech',
    location: 'Mechanical Workshop, Bay 2',
    openHour: 9,
    closeHour: 17,
  },
  {
    id: 'bio-mol',
    name: 'Molecular Biology Lab',
    departmentId: 'bio',
    location: 'Bio Sciences Block, Lab 3',
    openHour: 9,
    closeHour: 17,
  },
  {
    id: 'des-studio',
    name: 'Design Innovation Studio',
    departmentId: 'des',
    location: 'Design Centre, Ground Floor',
    openHour: 9,
    closeHour: 19,
  },
];

type EquipmentSeed = Omit<Equipment, 'departmentId'>;

const equipmentSeeds: EquipmentSeed[] = [
  {
    id: 'dso-keysight',
    name: 'Digital Storage Oscilloscope (Keysight DSOX1204G)',
    category: 'Electronics',
    labId: 'ece-adv',
    description:
      '4-channel, 200 MHz oscilloscope with protocol decoding for I2C, SPI and UART debugging.',
    capabilities: ['oscilloscope', 'signal-analysis', 'protocol-decoding', '4-channel'],
    units: 3,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'spectrum-rigol',
    name: 'Real-Time Spectrum Analyzer (Rigol RSA3030)',
    category: 'Electronics',
    labId: 'ece-adv',
    description:
      '9 kHz – 3 GHz real-time spectrum analyzer for RF characterisation and EMI pre-compliance.',
    capabilities: ['spectrum-analysis', 'rf', 'signal-analysis', 'emi-testing'],
    units: 1,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'vna-nano',
    name: 'Vector Network Analyzer (2-port, 6 GHz)',
    category: 'Electronics',
    labId: 'ece-adv',
    description: 'Measures S-parameters for antenna tuning, filter design and impedance matching.',
    capabilities: ['rf', 'antenna-testing', 's-parameters', 'impedance-matching'],
    units: 1,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'fpga-zedboard',
    name: 'FPGA Development Kit (Xilinx Zynq-7000 ZedBoard)',
    category: 'Embedded & IoT',
    labId: 'ece-emb',
    description:
      'Zynq SoC with dual ARM cores and programmable logic for hardware acceleration and Verilog/VHDL coursework.',
    capabilities: ['fpga', 'verilog', 'hardware-acceleration', 'arm'],
    units: 4,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 4,
  },
  {
    id: 'stm32-kit',
    name: 'STM32 Nucleo IoT Sensor Kit',
    category: 'Embedded & IoT',
    labId: 'ece-emb',
    description:
      'ARM Cortex-M4 board with temperature, IMU, gas and proximity sensor shields plus LoRa module.',
    capabilities: ['microcontroller', 'arm', 'sensors', 'low-power', 'lora'],
    units: 8,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 4,
  },
  {
    id: 'gpu-4090',
    name: 'GPU Workstation (NVIDIA RTX 4090, 24 GB)',
    category: 'Computing',
    labId: 'cse-ai',
    description:
      'Deep-learning workstation with 24 GB VRAM, 64 GB RAM, CUDA 12 and PyTorch preinstalled.',
    capabilities: ['gpu', 'deep-learning', 'cuda', 'model-training', 'computer-vision'],
    units: 2,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 4,
  },
  {
    id: 'jetson-orin',
    name: 'NVIDIA Jetson Orin Nano Developer Kit',
    category: 'Embedded & IoT',
    labId: 'cse-ai',
    description:
      'Edge-AI module for real-time inference, robotics and camera-based computer vision.',
    capabilities: ['edge-ai', 'gpu', 'computer-vision', 'cuda', 'robotics'],
    units: 5,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 4,
  },
  {
    id: 'vr-station',
    name: 'VR Development Station (Meta Quest 3 + RTX PC)',
    category: 'Computing',
    labId: 'cse-ai',
    description:
      'Tethered VR headset with a Unity/Unreal-ready workstation for immersive and HCI projects.',
    capabilities: ['vr', '3d-rendering', 'gpu', 'hci'],
    units: 1,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'printer-prusa',
    name: 'FDM 3D Printer (Prusa MK4)',
    category: 'Fabrication',
    labId: 'mech-fab',
    description:
      'Reliable PLA/PETG printing up to 250 × 210 × 220 mm for enclosures and functional prototypes.',
    capabilities: ['3d-printing', 'fdm', 'prototyping'],
    units: 3,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 6,
  },
  {
    id: 'printer-formlabs',
    name: 'Resin 3D Printer (Formlabs Form 3+)',
    category: 'Fabrication',
    labId: 'mech-fab',
    description: 'High-precision SLA printing for microfluidics, dental and fine mechanical parts.',
    capabilities: ['3d-printing', 'sla', 'high-precision', 'prototyping'],
    units: 1,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 6,
  },
  {
    id: 'laser-60w',
    name: 'CO₂ Laser Cutter (60 W)',
    category: 'Fabrication',
    labId: 'mech-fab',
    description:
      '600 × 400 mm bed for cutting and engraving acrylic, MDF and plywood. Safety induction required.',
    capabilities: ['laser-cutting', 'engraving', 'prototyping'],
    units: 1,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'pcb-lpkf',
    name: 'CNC PCB Milling Machine (LPKF ProtoMat)',
    category: 'Fabrication',
    labId: 'mech-fab',
    description:
      'Mills double-sided prototype PCBs in under an hour — no chemical etching required.',
    capabilities: ['pcb-milling', 'prototyping', 'cnc'],
    units: 1,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'utm-instron',
    name: 'Universal Testing Machine (Instron 5967)',
    category: 'Fabrication',
    labId: 'mech-fab',
    description: '30 kN tensile and compression testing for material characterisation.',
    capabilities: ['tensile-testing', 'material-testing'],
    units: 1,
    requiresApproval: true,
    status: 'maintenance',
    maxHoursPerBooking: 3,
  },
  {
    id: 'pcr-thermo',
    name: 'PCR Thermal Cycler (Bio-Rad T100)',
    category: 'Biotech',
    labId: 'bio-mol',
    description: '96-well gradient thermal cycler for DNA amplification and genotyping.',
    capabilities: ['pcr', 'dna-amplification', 'genotyping'],
    units: 2,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 4,
  },
  {
    id: 'microscope-fluor',
    name: 'Fluorescence Microscope (Olympus BX53)',
    category: 'Imaging & Optics',
    labId: 'bio-mol',
    description:
      'Upright microscope with DAPI/FITC/TRITC filters and a 20 MP camera for cell imaging.',
    capabilities: ['fluorescence', 'microscopy', 'imaging', 'cell-imaging'],
    units: 1,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'biosignal-kit',
    name: 'Biosignal Acquisition Kit (BITalino Revolution)',
    category: 'Biotech',
    labId: 'bio-mol',
    description:
      'Wearable EMG, ECG, EDA and EEG sensors with Bluetooth streaming for biomedical prototyping.',
    capabilities: ['emg', 'ecg', 'eeg', 'biosignals', 'sensors', 'wearables'],
    units: 2,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'laser-40w',
    name: 'Desktop Laser Cutter (40 W, Glowforge Pro)',
    category: 'Fabrication',
    labId: 'des-studio',
    description:
      'Camera-aligned laser cutter for acrylic, card and wood; ideal for enclosures and signage.',
    capabilities: ['laser-cutting', 'engraving', 'prototyping'],
    units: 1,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 3,
  },
  {
    id: 'printer-bambu',
    name: 'Multi-material 3D Printer (Bambu Lab X1C)',
    category: 'Fabrication',
    labId: 'des-studio',
    description:
      'Fast, multi-colour FDM printing with automatic calibration for design prototypes.',
    capabilities: ['3d-printing', 'fdm', 'prototyping', 'multi-material'],
    units: 2,
    requiresApproval: false,
    status: 'operational',
    maxHoursPerBooking: 6,
  },
];

const labDepartment = new Map(labs.map((lab) => [lab.id, lab.departmentId]));

export const equipment: Equipment[] = equipmentSeeds.map((seed) => {
  const departmentId = labDepartment.get(seed.labId);
  if (!departmentId) throw new Error(`Equipment ${seed.id} references unknown lab ${seed.labId}`);
  return { ...seed, departmentId };
});

export const personas: Persona[] = [
  {
    id: 's-priya',
    name: 'Priya Sharma',
    role: 'student',
    departmentId: 'ece',
    title: 'B.Tech ECE · Year 3',
  },
  {
    id: 's-arjun',
    name: 'Arjun Mehta',
    role: 'student',
    departmentId: 'mech',
    title: 'B.Tech Mechanical · Year 4',
  },
  {
    id: 's-zara',
    name: 'Zara Khan',
    role: 'student',
    departmentId: 'cse',
    title: 'M.Tech AI · Year 1',
  },
  {
    id: 's-rohan',
    name: 'Rohan Das',
    role: 'student',
    departmentId: 'bio',
    title: 'B.Tech Biotech · Year 2',
  },
  {
    id: 'f-rao',
    name: 'Dr. Kavitha Rao',
    role: 'faculty',
    departmentId: 'mech',
    title: 'Faculty in-charge · Fabrication Lab',
  },
  {
    id: 'f-iyer',
    name: 'Dr. Suresh Iyer',
    role: 'faculty',
    departmentId: 'cse',
    title: 'Faculty in-charge · AI & HPC Lab',
  },
  {
    id: 'f-nair',
    name: 'Dr. Anil Nair',
    role: 'faculty',
    departmentId: 'ece',
    title: 'Faculty in-charge · Electronics Labs',
  },
  {
    id: 'f-bose',
    name: 'Dr. Meera Bose',
    role: 'faculty',
    departmentId: 'bio',
    title: 'Faculty in-charge · Molecular Biology Lab',
  },
  {
    id: 'a-ops',
    name: 'Lab Operations Office',
    role: 'admin',
    departmentId: 'mech',
    title: 'Campus lab administrator',
  },
];
