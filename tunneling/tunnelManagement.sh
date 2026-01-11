cd /etc/systemd/system/
ls
touch ssh_tunnel_puerto_XXXX.service
nano ssh_tunnel_puerto_XXXX.service
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable ssh_tunnel_puerto_XXXX.service
sudo systemctl start ssh_tunnel_puerto_XXXX.service
sudo systemctl status ssh_tunnel_puerto_XXXX.service
sudo systemctl status ssh_tunnel_puerto_XXXX.service