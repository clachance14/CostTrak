#!/bin/bash

echo "🎭 Installing Playwright system dependencies"
echo ""
echo "This script will install the system libraries needed for Playwright browsers."
echo "You may need to enter your sudo password."
echo ""

# Detect the Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo "Cannot detect OS version"
    exit 1
fi

# Install dependencies based on the distribution
if [[ "$OS" == "Ubuntu" ]] || [[ "$OS" == "Debian"* ]]; then
    echo "Detected: $OS $VER"
    echo "Installing dependencies for Debian/Ubuntu..."
    
    # Update package list
    sudo apt-get update
    
    # Install Playwright dependencies
    sudo npx playwright install-deps
    
elif [[ "$OS" == "Fedora"* ]] || [[ "$OS" == "Red Hat"* ]] || [[ "$OS" == "CentOS"* ]]; then
    echo "Detected: $OS $VER"
    echo "Installing dependencies for Fedora/RHEL/CentOS..."
    
    # Install Playwright dependencies
    sudo npx playwright install-deps
    
else
    echo "Unsupported OS: $OS"
    echo "Please install the dependencies manually."
    echo ""
    echo "You can try running:"
    echo "  sudo npx playwright install-deps"
    exit 1
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Note: If you're running in WSL2, some GUI features might be limited."
echo "For headless testing (which is the default), these dependencies are optional."