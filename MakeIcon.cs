using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

class MakeIcon
{
    static void Main(string[] args)
    {
        string outPath = args.Length > 0 ? args[0] : "app.ico";
        using (Bitmap bmp = new Bitmap(64, 64))
        using (Graphics g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);

            using (GraphicsPath path = new GraphicsPath())
            {
                int r = 16;
                path.AddArc(2, 2, r, r, 180, 90);
                path.AddArc(62 - r, 2, r, r, 270, 90);
                path.AddArc(62 - r, 62 - r, r, r, 0, 90);
                path.AddArc(2, 62 - r, r, r, 90, 90);
                path.CloseFigure();

                using (LinearGradientBrush brush = new LinearGradientBrush(
                    new Rectangle(0, 0, 64, 64),
                    Color.FromArgb(16, 185, 129),
                    Color.FromArgb(79, 70, 229),
                    45f))
                {
                    g.FillPath(brush, path);
                }
            }

            using (Font font = new Font("Segoe UI", 30, FontStyle.Bold, GraphicsUnit.Pixel))
            using (StringFormat sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
            {
                g.DrawString("$", font, Brushes.White, new RectangleF(0, 1, 64, 64), sf);
            }

            using (MemoryStream pngStream = new MemoryStream())
            {
                bmp.Save(pngStream, ImageFormat.Png);
                byte[] pngBytes = pngStream.ToArray();

                using (FileStream fs = new FileStream(outPath, FileMode.Create))
                using (BinaryWriter bw = new BinaryWriter(fs))
                {
                    // ICONDIR header
                    bw.Write((short)0);   // reserved
                    bw.Write((short)1);   // type: 1 = ICO
                    bw.Write((short)1);   // count: 1 image

                    // ICONDIRENTRY
                    bw.Write((byte)64);   // width
                    bw.Write((byte)64);   // height
                    bw.Write((byte)0);    // colors
                    bw.Write((byte)0);    // reserved
                    bw.Write((short)1);   // color planes
                    bw.Write((short)32);  // bits per pixel
                    bw.Write(pngBytes.Length); // size
                    bw.Write(22);         // offset (6 + 16)

                    bw.Write(pngBytes);
                }
            }
        }
    }
}

