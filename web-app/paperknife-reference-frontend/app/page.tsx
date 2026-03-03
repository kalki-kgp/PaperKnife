'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { 
  Scissors, 
  CloudOff, 
  Zap, 
  WifiOff, 
  Link as LinkIcon, 
  FileBox, 
  Minimize2, 
  ArrowRight, 
  Download, 
  Cpu, 
  Save, 
  ShieldCheck,
  Twitter,
  Github,
  Linkedin,
  Shield
} from 'lucide-react';

export default function PaperKnifeLanding() {
  return (
    <div className="overflow-x-hidden selection:bg-terracotta/20">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-terracotta rounded-xl flex items-center justify-center text-white">
            <Scissors className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">PaperKnife</span>
        </div>
        
        <div className="hidden md:flex items-center gap-1 bg-white/50 backdrop-blur-md px-2 py-2 rounded-full border border-white/40">
          <a className="px-6 py-2 rounded-full bg-white shadow-sm font-medium text-text-main" href="#">Tools</a>
          <a className="px-6 py-2 rounded-full hover:bg-white/50 transition-colors font-medium text-text-main" href="#">Privacy</a>
          <a className="px-6 py-2 rounded-full hover:bg-white/50 transition-colors font-medium text-text-main" href="#">GitHub</a>
        </div>
        
        <button className="px-8 py-3 bg-terracotta text-white rounded-2xl font-semibold shadow-lg shadow-terracotta/30 hover:scale-105 transition-transform">
          Get Started
        </button>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-12 pb-24 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-orange-100 text-terracotta px-4 py-1.5 rounded-full text-sm font-semibold mb-8 border border-orange-200/50"
        >
          <span>Updates: Warm new interface released.</span>
          <a className="underline font-bold" href="#">Read more →</a>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight"
        >
          Your PDFs, Your Peace.<br/>
          <span className="text-terracotta">Your Protector.</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto text-text-muted text-xl mb-12 leading-relaxed"
        >
          Experience effortless security. Securely process your documents right in your browser with the comfort of knowing your files never leave your side. No uploads, just peace of mind.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
        >
          <button className="clay-button px-10 py-5 rounded-3xl text-lg font-bold w-full sm:w-auto">
            Start Protected
          </button>
          <button className="flex items-center gap-2 font-bold text-text-main hover:text-terracotta transition-colors group">
            How it works <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Hero Visual */}
        <div className="relative max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="aspect-[21/9] rounded-[48px] overflow-hidden bg-gradient-to-br from-orange-200 to-rose-100 shadow-2xl relative"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/soft-wallpaper.png')] opacity-30"></div>
            <Image 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBoPAwjqf6Vy4D_SFb7TgesWiOcvPFfEmI39j-IfB6s4A8t7PD1sN9Fp0oLq3fp3qtaLJv3UNE3L8tOZokabcsdimeFK96bYXkTsP_XLiV69uS3mP9cidPSr1SF9-1FMNWCAReh2IUIN3zJ_p_9kVL-q_teG_w7lSduONlMdu6By22A8TxeVPt80nyE2ZJZBLVJhq3Be72tvOzOsYBvPssbVz_DXbHr7fyRu0O3RhshrnnyxdB39UYijHigGwE6AickQ_k2k_StYnA"
              alt="Inviting 3D Mascot"
              fill
              className="object-cover mix-blend-overlay"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAWw7nY1_bPBMNYACrcwQ6MHh9lZRm9adUsTmyiX9gz6_Y2kb7SEcVkgAsDTBe9TiOuJ43UtucTfDJ1kXMLp1qI_N97Ow0utWGZE-DTgDcHfO-ybws4syj5wrGnGg9r1DL0ph1qt2tkJ4cHaF_Jt04ixpQvJdJr4ufdircPt-n940mx9SwhDr2siR1jyQPDYFQP6jsuHgjvPD1uZBn3_6rdeGoOktDqafOZ46fhi8uEm7HaFfORQBn2QX1OibOzEl8e-f82ulxQ6A"
                alt="Peaceful landscape"
                fill
                className="object-cover opacity-20"
                referrerPolicy="no-referrer"
              />
              <div className="relative z-10 scale-125">
                <div className="text-terracotta">
                  <Shield className="w-40 h-40 drop-shadow-2xl fill-current" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature Cards Overlay */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 -mt-16 px-6 relative z-20">
            <motion.div 
              whileHover={{ y: -5 }}
              className="clay-card-yellow p-8 text-left border-4 border-white/50"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-terracotta mb-4 shadow-inner">
                <CloudOff className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Privacy First</p>
              <h3 className="text-2xl font-bold">Zero Uploads</h3>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -5 }}
              className="clay-card-peach p-8 text-left border-4 border-white/50"
            >
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-terracotta mb-4 shadow-inner">
                <Zap className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Processing Speed</p>
              <h3 className="text-2xl font-bold">Instant</h3>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -5 }}
              className="clay-card p-8 text-left border-4 border-white/50"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-terracotta mb-4 shadow-inner">
                <WifiOff className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Offline Capable</p>
              <h3 className="text-2xl font-bold">100% Local</h3>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Toolkit Section */}
      <section className="bg-accent-yellow py-32 mt-20 rounded-[80px_80px_0_0]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-terracotta font-bold tracking-widest uppercase text-sm mb-4 block">Powerful Toolkit</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Everything you need to manage PDFs</h2>
            <p className="text-text-muted text-xl max-w-2xl mx-auto">
              All the essential tools, optimized for your machine, delivering a cozy and seamless experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ToolCard 
              icon={<LinkIcon className="w-8 h-8" />}
              title="Merge PDFs"
              description="Combine multiple files into one document in seconds, gently."
              type="default"
            />
            <ToolCard 
              icon={<Scissors className="w-8 h-8" />}
              title="Split PDFs"
              description="Extract pages or split documents into separate files with ease."
              type="peach"
            />
            <ToolCard 
              icon={<Minimize2 className="w-8 h-8" />}
              title="Compress"
              description="Reduce file size significantly without losing visible quality."
              type="yellow"
            />
            <ToolCard 
              icon={<FileBox className="w-8 h-8" />}
              title="Convert"
              description="Convert JPG to PDF, or export PDF pages as images instantly."
              type="default"
            />
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-32 bg-white rounded-[0_0_80px_80px] shadow-[0_40px_60px_-15px_rgba(230,138,115,0.1)]">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold mb-8">How it works securely</h2>
          <p className="text-text-muted text-xl max-w-2xl mb-16">
            Traditional online PDF tools require you to upload your sensitive documents to their servers. PaperKnife is different – it stays with you.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <Step 
              icon={<Download className="w-6 h-6" />}
              number="1"
              title="Load Application"
              description="When you open PaperKnife, the processing engine is downloaded once to your browser cache, safe and sound."
            />
            <Step 
              icon={<Cpu className="w-6 h-6" />}
              number="2"
              title="Process Locally"
              description="Files you select are processed by your computer's CPU. No data ever travels over the internet, keeping things private."
            />
            <Step 
              icon={<Save className="w-6 h-6" />}
              number="3"
              title="Save Instantly"
              description="Since the file is already on your computer, saving the modified PDF is instantaneous and perfectly secure."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-32">
        <div className="clay-card-peach p-16 text-center border-4 border-white/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShieldCheck className="w-32 h-32" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to take control?</h2>
          <p className="text-text-muted text-xl mb-12 max-w-xl mx-auto">
            Start processing your PDFs with complete peace of mind today. Your files are in safe hands—yours.
          </p>
          <button className="clay-button px-12 py-5 rounded-3xl text-lg font-bold">
            Start Using Tools
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white/50 pt-24 pb-12 border-t border-orange-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-terracotta rounded-lg flex items-center justify-center text-white">
                  <Scissors className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold tracking-tight">PaperKnife</span>
              </div>
              <p className="text-text-muted max-w-xs leading-relaxed">
                Making PDF manipulation secure, fast, and easy. Built for privacy enthusiasts who value comfort.
              </p>
            </div>
            
            <div>
              <h5 className="font-bold mb-6">Product</h5>
              <ul className="space-y-4 text-text-muted">
                <li><a className="hover:text-terracotta transition-colors" href="#">Merge PDF</a></li>
                <li><a className="hover:text-terracotta transition-colors" href="#">Split PDF</a></li>
                <li><a className="hover:text-terracotta transition-colors" href="#">Compress PDF</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-bold mb-6">Support</h5>
              <ul className="space-y-4 text-text-muted">
                <li><a className="hover:text-terracotta transition-colors" href="#">Documentation</a></li>
                <li><a className="hover:text-terracotta transition-colors" href="#">Guides</a></li>
                <li><a className="hover:text-terracotta transition-colors" href="#">API Status</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-bold mb-6">Legal</h5>
              <ul className="space-y-4 text-text-muted">
                <li><a className="hover:text-terracotta transition-colors" href="#">Terms of Service</a></li>
                <li><a className="hover:text-terracotta transition-colors" href="#">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-12 border-t border-orange-100 flex flex-col md:flex-row items-center justify-between gap-6 text-text-muted text-sm">
            <p>© 2024 PaperKnife, Inc. All rights reserved.</p>
            <div className="flex gap-8">
              <a className="hover:text-terracotta transition-colors" href="#"><Twitter className="w-5 h-5" /></a>
              <a className="hover:text-terracotta transition-colors" href="#"><Github className="w-5 h-5" /></a>
              <a className="hover:text-terracotta transition-colors" href="#"><Linkedin className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ToolCard({ icon, title, description, type }: { icon: React.ReactNode, title: string, description: string, type: 'default' | 'peach' | 'yellow' }) {
  const cardClass = type === 'peach' ? 'clay-card-peach' : type === 'yellow' ? 'clay-card-yellow' : 'clay-card';
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className={`${cardClass} p-8 transition-transform duration-300`}
    >
      <div className="w-14 h-14 bg-orange-100/50 rounded-2xl flex items-center justify-center text-terracotta mb-6 shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-text-muted leading-relaxed">{description}</p>
    </motion.div>
  );
}

function Step({ icon, number, title, description }: { icon: React.ReactNode, number: string, title: string, description: string }) {
  return (
    <div className="space-y-4">
      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-terracotta mb-6">
        {icon}
      </div>
      <h4 className="text-xl font-bold">{number}. {title}</h4>
      <p className="text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}
