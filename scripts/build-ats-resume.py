from pathlib import Path
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("ATS", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("ATS-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFontFamily("ATS", normal="ATS", bold="ATS-Bold", italic="ATS", boldItalic="ATS-Bold")
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from xml.sax.saxutils import escape

OUT=Path('output/pdf');OUT.mkdir(parents=True,exist_ok=True)
styles={
 'name':ParagraphStyle('name',fontName='ATS-Bold',fontSize=21,leading=25,spaceAfter=5,textColor=colors.HexColor('#142C45')),
 'role':ParagraphStyle('role',fontName='ATS-Bold',fontSize=12,leading=16,spaceAfter=7),
 'contact':ParagraphStyle('contact',fontName='ATS',fontSize=9,leading=13,spaceAfter=3),
 'section':ParagraphStyle('section',fontName='ATS-Bold',fontSize=11,leading=15,spaceBefore=12,spaceAfter=6,textColor=colors.HexColor('#142C45'),keepWithNext=True),
 'body':ParagraphStyle('body',fontName='ATS',fontSize=10,leading=14.2,spaceAfter=6),
 'job':ParagraphStyle('job',fontName='ATS-Bold',fontSize=10,leading=14,spaceBefore=7,spaceAfter=2,keepWithNext=True),
 'date':ParagraphStyle('date',fontName='ATS',fontSize=9.4,leading=13,spaceAfter=5,keepWithNext=True),
 'bullet':ParagraphStyle('bullet',fontName='ATS',fontSize=10,leading=14,leftIndent=10,firstLineIndent=-10,spaceAfter=4),
}
def p(text,style='body'):return Paragraph(text,styles[style])
def header():
 return [p('Aditya Shashikant Kadam','name'),p('Assistant Technical Project Manager','role'),p('Mumbai, India | +91 9769601519 | adityakadamjd@gmail.com','contact'),p('LinkedIn: <link href="https://www.linkedin.com/in/aditya-k-142874111/">linkedin.com/in/aditya-k-142874111</link> | GitHub: <link href="https://github.com/The-Aditya-Kadam">github.com/The-Aditya-Kadam</link>','contact'),p('Portfolio: <link href="https://aditya-kadam-resume.onrender.com/">aditya-kadam-resume.onrender.com</link>','contact')]
def section(text):return p(text.upper(),'section')
def job(role,company,dates,bullets):
 result=[p(escape(role),'job'),p(escape(company+' | '+dates),'date')]
 result.extend(p('- '+escape(text),'bullet') for text in bullets)
 return result
story=header()+[section('Professional Summary'),p('Assistant Technical Project Manager with 10+ years in web engineering and 7+ years in digital marketing. Experience coordinating full-lifecycle web delivery, Agile sprint planning, scope and milestone tracking, resource allocation, stakeholder communication and quality assurance. Combines hands-on WordPress and PHP expertise with cross-functional team leadership, technical SEO and analytics. Uses Jira, Zoho Sprints, HubSpot and Power BI to support project execution and reporting.'),section('Core Skills'),p('<b>Project delivery:</b> Agile, Scrum, Kanban, sprint planning, backlog grooming, scope definition, milestone management, risk assessment, resource allocation, client communication and QA governance.'),p('<b>Tools:</b> Jira, Zoho CRM / Zoho Sprints, HubSpot, Power BI, GA4, Google Search Console and Google Tag Manager.'),p('<b>Technical:</b> WordPress, WooCommerce, Shopify, PHP, MySQL, JavaScript, HTML5, CSS3, technical SEO, Core Web Vitals, accessibility and server migrations.'),section('Professional Experience')]
story+=job('Assistant Technical Project Manager / Web Team Leader','Rath Infotech','Jan 2026 - Present',[
'Coordinate client web projects from requirements and scope definition through development, testing and launch; track timelines, task allocation and milestones.',
'Lead frontend, backend, digital marketing and QA teams through daily standups, sprint planning and retrospectives; manage engineering backlogs.',
'Act as a client point of contact for requirements, progress updates and feedback; align technical delivery with business objectives.',
'Review deliverables for quality, accessibility, web performance and Core Web Vitals; resolve technical roadblocks before delivery.'
])
story+=job('Senior WordPress Developer and Team Lead','Velocity Media Lab - Freelancing','May 2025 - Oct 2025',[
'Coordinated concurrent WordPress delivery tasks across development, design and content teams using HubSpot; communicated progress and deadlines to clients.',
'Resolved JavaScript errors, Core Web Vitals and accessibility issues; improved landing-page performance and usability.'
])
story+=[PageBreak(),section('Professional Experience - Continued')]
story+=job('Senior WordPress Developer and Team Lead','Epicenter Technologies Pvt. Ltd.','May 2023 - Mar 2025',[
'Led CMS delivery, release roadmaps and sprint delegation using Zoho CRM and Zoho Sprints; coordinated with clients and partner agencies.',
'Developed Power BI dashboards using GA4 and Google Search Console metrics to give stakeholders visibility into website performance.',
'Improved Core Web Vitals, site speed, accessibility and technical site health across web properties.'
])
story+=job('Senior WordPress Developer and Team Lead','Futran Tech Solutions Pvt. Ltd., Pune','Jan 2020 - Mar 2023',[
'Coordinated team tasks, sprint reviews, QA audits and client status updates using Jira; reviewed deliverables before submission.',
'Delivered campaign landing pages and supported SEO, analytics and digital marketing reporting against ROI and KPI goals.'
])
story+=job('Senior WordPress Developer and Team Lead','Aconnect Mumbai - Australian-based company','Feb 2018 - Jan 2020',[
'Managed WordPress and WooCommerce delivery, technical SEO improvements and tracking integrations for Australian clients.',
'Led digital marketing team members; integrated Google Tag Manager and payment gateways and reported website analytics.'
])
story+=job('WordPress and PHP Developer','Moblixs Technology Pvt. Ltd.','Feb 2014 - Dec 2017',[
'Developed custom WordPress and PHP websites, responsive web content, interactive assessments and e-learning assets from client specifications.',
'Supported website performance, accessibility, on-page SEO and analytics reporting.'
])
story+=[section('Education and Certification'),p("<b>Bachelor's Degree in Banking &amp; Finance</b> | Mumbai University | 2025"),p('<b>Postgraduate Certification in Data Science</b> | Purdue University - Simplilearn | 2024<br/>Certificate ID: 82222995'),section('Awards'),p('Best Team Leader &amp; Manager - Adam Parks, July 2024<br/>Best Performance &amp; Team Lead - Futran Tech Solutions, November 2022<br/>Best Performance &amp; Team Lead - Aconnect, December 2020')]
resume=OUT/'Aditya-Kadam-Assistant-Technical-Project-Manager-Resume.pdf'
SimpleDocTemplate(str(resume),pagesize=A4,rightMargin=43,leftMargin=43,topMargin=36,bottomMargin=36,title='Aditya Kadam - Assistant Technical Project Manager Resume',author='Aditya Shashikant Kadam').build(story)
letter=header()+[Spacer(1,18),p('<b>Application for Assistant Technical Project Manager</b>'),Spacer(1,8),p('Dear Hiring Manager,'),p('I am applying for an Assistant Technical Project Manager position. My background combines hands-on web engineering with team leadership, client communication and Agile project delivery. I bring 10+ years in web development and 7+ years in digital marketing, supported by experience with Jira, Zoho Sprints, HubSpot and performance reporting.'),p('At Rath Infotech, I coordinate client web projects from requirements and scope planning through development, quality assurance and launch. I work with frontend and backend developers, marketing teams and QA testers to manage priorities, track milestones and communicate progress. My technical background helps me identify delivery risks, resolve roadblocks and review website quality before release.'),p('In previous team leadership roles at Velocity Media Lab, Epicenter Technologies and Futran Tech Solutions, I coordinated tasks and release activities, maintained client communication and supported website performance and analytics. I also developed Power BI dashboards using GA4 and Google Search Console data to improve stakeholder visibility.'),p('I would welcome the opportunity to support your project manager and technical teams with structured planning, clear status reporting, practical problem solving and consistent follow-through. I am based in Mumbai and open to remote work and relocation.'),p('Thank you for considering my application. I would be glad to discuss how my technical delivery and team leadership experience can contribute to your projects.'),Spacer(1,10),p('Sincerely,<br/><b>Aditya Shashikant Kadam</b>')]
cover=OUT/'Aditya-Kadam-Assistant-Technical-Project-Manager-Cover-Letter.pdf'
SimpleDocTemplate(str(cover),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=45,bottomMargin=45,title='Aditya Kadam - Assistant Technical Project Manager Cover Letter',author='Aditya Shashikant Kadam').build(letter)
print(resume);print(cover)
